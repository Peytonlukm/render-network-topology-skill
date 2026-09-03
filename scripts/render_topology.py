#!/usr/bin/env python3
"""Render a normalized Topology Model to a self-contained HTML/SVG document."""

from __future__ import annotations

import argparse
import html
import json
import math
import re
import sys
from pathlib import Path
from typing import Any


CANVAS_WIDTH = 1440
CANVAS_HEIGHT = 900
GRID = 24
NODE_WIDTH = 108
NODE_HEIGHT = 88
ICON_TYPES = {
    "access-switch", "api-gateway", "app-server", "availability-zone", "backup", "bastion-host",
    "branch-site", "cache", "camera", "cellular-gateway", "cloud", "cloud-gateway", "cloud-region",
    "container", "core-switch", "data-center", "database", "ddos-protection", "dhcp", "directory-service",
    "disaster-recovery", "distribution-switch", "dns", "endpoint", "fiber", "firewall", "ids-ips",
    "industrial-gateway", "internet", "iot-device", "ip-phone", "kubernetes", "laptop", "load-balancer",
    "message-queue", "mobile", "monitoring", "nas", "object-storage", "ont", "pc", "printer", "proxy",
    "rack", "router", "san", "sd-wan", "search", "secure-web-gateway", "server", "siem", "storage",
    "subnet", "switch", "tape-library", "thin-client", "ups", "virtual-machine", "vpn-gateway", "vpc",
    "waf", "web-server", "wireless", "wireless-ap", "wireless-controller", "zero-trust-gateway",
}
STATUS_CLASS = {"normal", "highlight", "warning", "alert", "failure", "standby"}
EDGE_ROLES = {"", "primary", "redundant", "heartbeat", "management"}
DETAIL_LEVELS = {"faithful", "balanced", "simplified"}
AUDIENCE_LEVELS = {"engineer", "mixed", "executive"}
DESTINATIONS = {"viewer", "doc-wide", "slide-16x9", "print"}
ANCHOR_VECTORS = {
    "right": (1.0, 0.0),
    "bottom-right": (0.7071067812, 0.7071067812),
    "bottom": (0.0, 1.0),
    "bottom-left": (-0.7071067812, 0.7071067812),
    "left": (-1.0, 0.0),
    "top-left": (-0.7071067812, -0.7071067812),
    "top": (0.0, -1.0),
    "top-right": (0.7071067812, -0.7071067812),
}
EDGE_ANCHORS = set(ANCHOR_VECTORS)
TYPE_RANK = {
    "internet": 0, "cloud": 0, "cloud-region": 0, "availability-zone": 0, "branch-site": 0,
    "router": 1, "firewall": 1, "waf": 1, "ids-ips": 1, "ddos-protection": 1,
    "load-balancer": 1, "api-gateway": 1, "proxy": 1, "vpn-gateway": 1, "sd-wan": 1,
    "secure-web-gateway": 1, "zero-trust-gateway": 1, "cloud-gateway": 1,
    "switch": 2, "core-switch": 2, "distribution-switch": 2, "access-switch": 2,
    "fiber": 2, "ont": 2, "cellular-gateway": 2, "wireless-controller": 2,
    "wireless": 3, "wireless-ap": 3, "server": 3, "web-server": 3, "app-server": 3,
    "virtual-machine": 3, "container": 3, "kubernetes": 3, "database": 3, "cache": 3,
    "message-queue": 3, "search": 3, "dns": 3, "dhcp": 3, "directory-service": 3,
    "bastion-host": 3, "monitoring": 3, "siem": 3, "backup": 3, "disaster-recovery": 3,
    "storage": 3, "nas": 3, "san": 3, "object-storage": 3, "tape-library": 3,
    "vpc": 3, "subnet": 3, "data-center": 3, "rack": 3, "ups": 3,
    "pc": 4, "laptop": 4, "mobile": 4, "thin-client": 4, "printer": 4,
    "ip-phone": 4, "camera": 4, "iot-device": 4, "industrial-gateway": 4, "endpoint": 4,
}


def safe_text(value: Any) -> str:
    return html.escape(str(value), quote=True)


def safe_id(value: Any, prefix: str) -> str:
    result = re.sub(r"[^A-Za-z0-9_-]", "-", str(value)).strip("-")
    return f"{prefix}-{result or 'item'}"


def normalize_anchor(value: Any) -> str | None:
    if isinstance(value, str):
        anchor = value.lower()
    elif isinstance(value, dict):
        anchor = str(value.get("side", "")).lower()
    else:
        anchor = ""
    return anchor if anchor in EDGE_ANCHORS else None


def snap(value: float, grid: int) -> float:
    return math.ceil(value / grid) * grid


def load_model(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as source:
        model = json.load(source)
    if not isinstance(model, dict):
        raise ValueError("Topology Model must be a JSON object.")
    model.setdefault("title", "Network Topology")
    model.setdefault("canvas", {})
    model.setdefault("nodes", [])
    model.setdefault("edges", [])
    model.setdefault("groups", [])
    if not isinstance(model["nodes"], list) or not isinstance(model["edges"], list):
        raise ValueError("nodes and edges must be arrays.")
    return model


def normalize_model(model: dict[str, Any], theme_override: str | None) -> dict[str, Any]:
    canvas = model["canvas"] if isinstance(model["canvas"], dict) else {}
    model["canvas"] = canvas
    canvas["width"] = float(canvas.get("width", CANVAS_WIDTH))
    canvas["height"] = float(canvas.get("height", CANVAS_HEIGHT))
    canvas["theme"] = theme_override or canvas.get("theme", "light")
    canvas["layout"] = str(canvas.get("layout", "enterprise")).lower()
    canvas["direction"] = str(canvas.get("direction", "lr")).lower()
    canvas["edge_style"] = str(canvas.get("edge_style", "")).lower()
    canvas["grid"] = int(canvas.get("grid", GRID))
    canvas["snap"] = int(canvas.get("snap", canvas["grid"]))
    canvas["editable"] = bool(canvas.get("editable", True))
    canvas["detail"] = str(canvas.get("detail", "faithful")).lower()
    canvas["audience"] = str(canvas.get("audience", "mixed")).lower()
    canvas["destination"] = str(canvas.get("destination", "viewer")).lower()
    if canvas["theme"] not in {"light", "dark"}:
        canvas["theme"] = "light"
    if canvas["layout"] not in {"enterprise", "manual"}:
        canvas["layout"] = "enterprise"
    if canvas["direction"] != "lr":
        canvas["direction"] = "lr"
    if canvas["edge_style"] not in {"", "straight", "orthogonal", "curved", "wireless"}:
        canvas["edge_style"] = ""
    if canvas["detail"] not in DETAIL_LEVELS:
        canvas["detail"] = "faithful"
    if canvas["audience"] not in AUDIENCE_LEVELS:
        canvas["audience"] = "mixed"
    if canvas["destination"] not in DESTINATIONS:
        canvas["destination"] = "viewer"
    canvas["grid"] = max(8, min(48, canvas["grid"]))
    canvas["snap"] = max(8, min(48, canvas["snap"]))

    ids: set[str] = set()
    nodes: list[dict[str, Any]] = []
    for index, raw in enumerate(model["nodes"]):
        if not isinstance(raw, dict) or not raw.get("id"):
            raise ValueError("Every node must be an object with an id.")
        node = dict(raw)
        node["id"] = str(node["id"])
        if node["id"] in ids:
            raise ValueError(f"Duplicate node id: {node['id']}")
        ids.add(node["id"])
        node["label"] = str(node.get("label", node["id"]))
        node["type"] = str(node.get("type", "endpoint")).lower()
        if node["type"] not in ICON_TYPES:
            node["type"] = "endpoint"
        node["status"] = str(node.get("status", "normal")).lower()
        if node["status"] not in STATUS_CLASS:
            node["status"] = "normal"
        node["group"] = str(node["group"]) if node.get("group") is not None else None
        node["rank"] = int(node.get("rank", TYPE_RANK[node["type"]]))
        node["order"] = int(node.get("order", index))
        node["x"] = float(node["x"]) if node.get("x") is not None else None
        node["y"] = float(node["y"]) if node.get("y") is not None else None
        node["compact"] = bool(node.get("compact", False))
        node["locked"] = bool(node.get("locked", False))
        nodes.append(node)
    model["nodes"] = nodes
    nodes_by_id = {node["id"]: node for node in nodes}

    for index, raw in enumerate(model["edges"]):
        if not isinstance(raw, dict):
            raise ValueError(f"Edge {index + 1} must be an object.")
        edge = raw
        edge.setdefault("id", f"edge-{index + 1}")
        edge["id"] = str(edge["id"])
        edge["source"] = str(edge.get("source", ""))
        edge["target"] = str(edge.get("target", ""))
        if edge["source"] not in ids or edge["target"] not in ids:
            raise ValueError(f"Edge {edge['id']} references an unknown node.")
        default_style = "wireless" if {nodes_by_id[edge["source"]]["type"], nodes_by_id[edge["target"]]["type"]} & {"wireless", "wireless-ap"} else "orthogonal"
        edge["style"] = str(edge.get("style", default_style)).lower()
        if canvas["edge_style"]:
            edge["style"] = canvas["edge_style"]
        if edge["style"] not in {"straight", "orthogonal", "curved", "wireless"}:
            edge["style"] = default_style
        edge["status"] = str(edge.get("status", "normal")).lower()
        if edge["status"] not in STATUS_CLASS:
            edge["status"] = "normal"
        edge["role"] = str(edge.get("role", "")).lower()
        if edge["role"] not in EDGE_ROLES:
            edge["role"] = ""
        if edge["role"] in {"redundant", "heartbeat"} and edge["status"] == "normal":
            edge["status"] = "standby"
        edge["label"] = str(edge.get("label", ""))
        edge["direction"] = bool(edge.get("direction", False))
        edge["flow"] = bool(edge.get("flow", False))  # Preserved in embedded JSON; never animated.
        edge["locked"] = bool(edge.get("locked", False))
        edge["source_anchor"] = normalize_anchor(edge.get("source_anchor"))
        edge["target_anchor"] = normalize_anchor(edge.get("target_anchor"))
        raw_waypoints = edge.get("waypoints", [])
        if not isinstance(raw_waypoints, list):
            raw_waypoints = []
        edge["waypoints"] = [
            {"x": float(point["x"]), "y": float(point["y"])}
            for point in raw_waypoints[:8]
            if isinstance(point, dict) and point.get("x") is not None and point.get("y") is not None
        ]
        offset = edge.get("label_offset", {})
        edge["label_offset"] = {
            "x": float(offset.get("x", 0)) if isinstance(offset, dict) else 0.0,
            "y": float(offset.get("y", 0)) if isinstance(offset, dict) else 0.0,
        }

    groups: list[dict[str, Any]] = []
    for index, raw in enumerate(model["groups"]):
        if not isinstance(raw, dict) or not raw.get("id"):
            raise ValueError("Every group must be an object with an id.")
        group = dict(raw)
        group["id"] = str(group["id"])
        group["label"] = str(group.get("label", group["id"]))
        group["order"] = int(group["order"]) if group.get("order") is not None else index
        group["locked"] = bool(group.get("locked", False))
        for key in ("x", "y", "width", "height", "padding"):
            if group.get(key) is not None:
                group[key] = float(group[key])
        groups.append(group)
    model["groups"] = groups
    return model


def default_positions(model: dict[str, Any]) -> None:
    nodes = model["nodes"]
    missing = [node for node in nodes if node["x"] is None or node["y"] is None]
    if not missing:
        return
    width = model["canvas"]["width"]
    height = model["canvas"]["height"]
    columns = max(1, math.ceil(math.sqrt(len(missing))))
    rows = max(1, math.ceil(len(missing) / columns))
    for index, node in enumerate(missing):
        col, row = index % columns, index // columns
        node["x"] = width * (col + 1) / (columns + 1)
        node["y"] = height * (row + 1) / (rows + 1)


def apply_enterprise_layout(model: dict[str, Any]) -> None:
    """Arrange named zones as generous left-to-right architecture columns."""
    canvas = model["canvas"]
    if canvas["layout"] == "manual":
        default_positions(model)
        return
    grid = canvas["grid"]
    members: dict[str, list[dict[str, Any]]] = {}
    for node in model["nodes"]:
        members.setdefault(node["group"] or "__ungrouped__", []).append(node)
    groups = list(model["groups"])
    known_ids = {group["id"] for group in groups}
    for group_id in members:
        if group_id not in known_ids:
            groups.append({"id": group_id, "label": "未分组设备", "order": len(groups)})

    def sort_key(group: dict[str, Any]) -> tuple[int, int, str]:
        group_members = members.get(group["id"], [])
        rank = min((node["rank"] for node in group_members), default=99)
        explicit = group.get("order")
        return (rank if explicit is None else explicit, rank, group["label"])

    groups.sort(key=sort_key)
    padding = 72
    title_height = 48
    node_gap_y = 72
    column_gap = 64
    group_gap = 64
    margin = 96
    metrics: list[tuple[dict[str, Any], list[dict[str, Any]], int, int, float]] = []
    tallest = 420.0
    for group in groups:
        items = sorted(members.get(group["id"], []), key=lambda node: (node["rank"], node["order"], node["label"]))
        columns = 1 if len(items) <= 2 else 2
        rows = max(1, math.ceil(len(items) / columns))
        width = max(280.0, padding * 2 + columns * NODE_WIDTH + (columns - 1) * column_gap)
        device_height = rows * NODE_HEIGHT + (rows - 1) * node_gap_y
        height = title_height + padding + device_height + padding
        tallest = max(tallest, height)
        metrics.append((group, items, columns, rows, width))
    zone_height = snap(tallest, grid)
    canvas["height"] = max(canvas["height"], snap(zone_height + margin * 2, grid))
    zone_y = snap((canvas["height"] - zone_height) / 2, grid)
    cursor_x = margin
    for group, items, columns, rows, width in metrics:
        width = snap(width, grid)
        group["_layout_box"] = {"x": cursor_x, "y": zone_y, "w": width, "h": zone_height}
        device_width = columns * NODE_WIDTH + (columns - 1) * column_gap
        device_height = rows * NODE_HEIGHT + (rows - 1) * node_gap_y
        start_x = cursor_x + (width - device_width) / 2
        usable_top = zone_y + title_height
        usable_height = zone_height - title_height
        start_y = usable_top + (usable_height - device_height) / 2
        for index, node in enumerate(items):
            col = index % columns
            row = index // columns
            node["x"] = snap(start_x + col * (NODE_WIDTH + column_gap) + NODE_WIDTH / 2, grid)
            node["y"] = snap(start_y + row * (NODE_HEIGHT + node_gap_y) + NODE_HEIGHT / 2, grid)
        cursor_x += width + group_gap
    canvas["width"] = max(canvas["width"], snap(cursor_x - group_gap + margin, grid))
    model["groups"] = groups


def group_boxes(model: dict[str, Any]) -> list[dict[str, Any]]:
    boxes: list[dict[str, Any]] = []
    nodes_by_group: dict[str, list[dict[str, Any]]] = {}
    for node in model["nodes"]:
        if node["group"]:
            nodes_by_group.setdefault(node["group"], []).append(node)
    for group in model["groups"]:
        if "_layout_box" in group and model["canvas"].get("layout") != "manual":
            box = group["_layout_box"]
            boxes.append({"id": group["id"], "label": group["label"], **box})
            continue
        members = nodes_by_group.get(group["id"], [])
        if not members:
            continue
        padding = float(group.get("padding", 64))
        xs = [node["x"] for node in members]
        ys = [node["y"] for node in members]
        boxes.append({
            "id": group["id"], "label": group["label"],
            "x": float(group.get("x", min(xs) - padding)),
            "y": float(group.get("y", min(ys) - padding - 28)),
            "w": max(280.0, float(group.get("width", max(xs) - min(xs) + padding * 2))),
            "h": max(320.0, float(group.get("height", max(ys) - min(ys) + padding * 2 + 28))),
        })
    return boxes


def node_radius(node: dict[str, Any]) -> float:
    return 32.0 if node.get("compact") else 42.0


def boundary_point(node: dict[str, Any], other: dict[str, Any], anchor: str | None = None) -> tuple[float, float]:
    radius = node_radius(node)
    if anchor in ANCHOR_VECTORS:
        vector_x, vector_y = ANCHOR_VECTORS[anchor]
        return node["x"] + radius * vector_x, node["y"] + radius * vector_y
    dx, dy = other["x"] - node["x"], other["y"] - node["y"]
    if abs(dx) >= abs(dy):
        return node["x"] + (radius if dx >= 0 else -radius), node["y"]
    return node["x"], node["y"] + (radius if dy >= 0 else -radius)


def path_midpoint(points: list[tuple[float, float]]) -> tuple[float, float]:
    if len(points) < 2:
        return points[0] if points else (0.0, 0.0)
    lengths = [math.hypot(points[index + 1][0] - points[index][0], points[index + 1][1] - points[index][1]) for index in range(len(points) - 1)]
    distance = sum(lengths) / 2
    for index, length in enumerate(lengths):
        if distance <= length or index == len(lengths) - 1:
            start, end = points[index], points[index + 1]
            ratio = 0 if length == 0 else distance / length
            return start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio
        distance -= length
    return points[-1]


def orthogonal_points(start: tuple[float, float], end: tuple[float, float], waypoints: list[dict[str, Any]]) -> list[tuple[float, float]]:
    points = [start]
    for waypoint in waypoints:
        next_point = (float(waypoint["x"]), float(waypoint["y"]))
        current = points[-1]
        if abs(next_point[0] - current[0]) >= abs(next_point[1] - current[1]):
            bend = (next_point[0], current[1])
        else:
            bend = (current[0], next_point[1])
        if bend != current and bend != next_point:
            points.append(bend)
        if next_point != points[-1]:
            points.append(next_point)
    current = points[-1]
    if abs(end[0] - current[0]) >= abs(end[1] - current[1]):
        bend = (end[0], current[1])
    else:
        bend = (current[0], end[1])
    if bend != current and bend != end:
        points.append(bend)
    if end != points[-1]:
        points.append(end)
    return points


def polyline_path(points: list[tuple[float, float]]) -> str:
    if not points:
        return ""
    commands = [f"M {points[0][0]:.1f} {points[0][1]:.1f}"]
    commands.extend(f"L {point[0]:.1f} {point[1]:.1f}" for point in points[1:])
    return " ".join(commands)


def rounded_polyline_path(points: list[tuple[float, float]], radius: float = 8.0) -> str:
    """Return a readable polyline with small rounded corners.

    The route remains axis-aligned when the supplied points are axis-aligned;
    the arcs only soften a turn and never introduce a decorative curve.
    """
    clean: list[tuple[float, float]] = []
    for point in points:
        point = (float(point[0]), float(point[1]))
        if not clean or point != clean[-1]:
            clean.append(point)
    if len(clean) < 2:
        return polyline_path(clean)
    commands = [f"M {clean[0][0]:.1f} {clean[0][1]:.1f}"]
    for index in range(1, len(clean) - 1):
        previous, current, following = clean[index - 1], clean[index], clean[index + 1]
        incoming = math.hypot(current[0] - previous[0], current[1] - previous[1])
        outgoing = math.hypot(following[0] - current[0], following[1] - current[1])
        if incoming < 0.01 or outgoing < 0.01:
            commands.append(f"L {current[0]:.1f} {current[1]:.1f}")
            continue
        corner_radius = min(radius, incoming / 2, outgoing / 2)
        in_unit = ((current[0] - previous[0]) / incoming, (current[1] - previous[1]) / incoming)
        out_unit = ((following[0] - current[0]) / outgoing, (following[1] - current[1]) / outgoing)
        before = (current[0] - in_unit[0] * corner_radius, current[1] - in_unit[1] * corner_radius)
        after = (current[0] + out_unit[0] * corner_radius, current[1] + out_unit[1] * corner_radius)
        commands.append(f"L {before[0]:.1f} {before[1]:.1f}")
        commands.append(f"Q {current[0]:.1f} {current[1]:.1f} {after[0]:.1f} {after[1]:.1f}")
    commands.append(f"L {clean[-1][0]:.1f} {clean[-1][1]:.1f}")
    return " ".join(commands)


def edge_path(source: dict[str, Any], target: dict[str, Any], style: str, waypoints: list[dict[str, Any]] | None = None, source_anchor: str | None = None, target_anchor: str | None = None) -> tuple[str, float, float, tuple[float, float], float]:
    sx, sy = boundary_point(source, target, source_anchor)
    tx, ty = boundary_point(target, source, target_anchor)
    angle = math.degrees(math.atan2(ty - sy, tx - sx))
    waypoints = waypoints or []
    if style == "straight":
        points = [(sx, sy)] + [(float(point["x"]), float(point["y"])) for point in waypoints] + [(tx, ty)]
        lx, ly = path_midpoint(points)
        path = rounded_polyline_path(points) if waypoints else polyline_path(points)
        return path, lx, ly, (sx, sy), angle
    if style in {"curved", "wireless"}:
        mid_x = (sx + tx) / 2
        if waypoints:
            control_x, control_y = float(waypoints[0]["x"]), float(waypoints[0]["y"])
        else:
            bow = max(48, min(132, abs(tx - sx) * 0.24 + abs(ty - sy) * 0.16))
            control_x, control_y = mid_x, (sy + ty) / 2 - bow if sy <= ty else (sy + ty) / 2 + bow
        return f"M {sx:.1f} {sy:.1f} Q {control_x:.1f} {control_y:.1f} {tx:.1f} {ty:.1f}", control_x, control_y, (sx, sy), angle
    if waypoints:
        points = orthogonal_points((sx, sy), (tx, ty), waypoints)
        lx, ly = path_midpoint(points)
        return rounded_polyline_path(points), lx, ly, (sx, sy), angle
    if abs(tx - sx) < 1:
        return f"M {sx:.1f} {sy:.1f} L {tx:.1f} {ty:.1f}", sx, (sy + ty) / 2, (sx, sy), angle
    if abs(ty - sy) < 1:
        return f"M {sx:.1f} {sy:.1f} L {tx:.1f} {ty:.1f}", (sx + tx) / 2, sy, (sx, sy), angle
    mid_x = (sx + tx) / 2
    points = [(sx, sy), (mid_x, sy), (mid_x, ty), (tx, ty)]
    return rounded_polyline_path(points), mid_x, (sy + ty) / 2, (sx, sy), angle


def icon_defs() -> str:
    path = Path(__file__).resolve().parent.parent / "assets" / "device-icons.svg"
    payload = path.read_text(encoding="utf-8")
    match = re.search(r"<defs>(.*)</defs>", payload, flags=re.DOTALL)
    if not match:
        raise RuntimeError("device-icons.svg must contain a defs element.")
    return match.group(1)


def label_markup(node: dict[str, Any]) -> str:
    label = str(node["label"])
    radius = node_radius(node)
    max_chars = 8 if node.get("compact") else 11
    base_font_size = 9.5 if node.get("compact") else 11
    baseline = radius - (12 if node.get("compact") else 14)
    words = re.split(r"\s+", label.strip())
    lines = [label]
    if len(label) > max_chars and len(words) > 1:
        split_at = min(range(1, len(words)), key=lambda index: abs(len(" ".join(words[:index])) - len(" ".join(words[index:]))))
        lines = [" ".join(words[:split_at]), " ".join(words[split_at:])]
    elif len(label) > max_chars and "-" in label:
        left, right = label.rsplit("-", 1)
        lines = [left, f"-{right}"]

    def text_line(value: str, y: float) -> str:
        font_size = max(7.0, base_font_size * min(1.0, max_chars / max(1, len(value))))
        return f'<text x="0" y="{y:.1f}" text-anchor="middle" font-size="{font_size:.1f}">{safe_text(value)}</text>'

    if len(lines) == 1:
        return text_line(lines[0], baseline)
    return text_line(lines[0], baseline - 11) + text_line(lines[1], baseline)


def render_svg(model: dict[str, Any]) -> str:
    width = model["canvas"]["width"]
    height = model["canvas"]["height"]
    nodes = {node["id"]: node for node in model["nodes"]}
    group_markup: list[str] = []
    for box in group_boxes(model):
        label_width = max(92.0, min(box["w"] - 32.0, len(str(box["label"])) * 11.0 + 34.0))
        group_markup.append(
            f'<g class="group" id="{safe_id(box["id"], "group")}" data-group-id="{safe_text(box["id"])}">'
            f'<rect x="{box["x"]:.1f}" y="{box["y"]:.1f}" width="{box["w"]:.1f}" height="{box["h"]:.1f}" rx="8"/>'
            f'<rect class="group-label-mask" x="{box["x"] + 16:.1f}" y="{box["y"] + 12:.1f}" width="{label_width:.1f}" height="26" rx="4"/>'
            f'<text x="{box["x"] + 28:.1f}" y="{box["y"] + 31:.1f}">{safe_text(box["label"])}</text></g>'
        )
    groups = "".join(group_markup)
    edge_markup: list[str] = []
    labels: list[str] = []
    wireless_signals: list[str] = []
    for edge in model["edges"]:
        path, lx, ly, origin, angle = edge_path(nodes[edge["source"]], nodes[edge["target"]], edge["style"], edge.get("waypoints", []), edge.get("source_anchor"), edge.get("target_anchor"))
        # Keep labels legible without covering the connector stroke. Users can
        # still fine-tune the final position with label_offset in edit mode.
        if abs(math.cos(math.radians(angle))) >= abs(math.sin(math.radians(angle))):
            ly -= 18
        else:
            lx += 18
        lx += edge.get("label_offset", {}).get("x", 0)
        ly += edge.get("label_offset", {}).get("y", 0)
        marker = ' marker-end="url(#arrow)"' if edge["direction"] and edge["style"] != "wireless" else ""
        edge_markup.append(
            f'<g class="edge-item" data-edge-id="{safe_text(edge["id"])}">'
            f'<path id="{safe_id(edge["id"], "edge")}" data-edge-id="{safe_text(edge["id"])}" data-source="{safe_text(edge["source"])}" data-target="{safe_text(edge["target"])}" class="edge {edge["status"]} {edge["role"]} {edge["style"]}" d="{path}"{marker}/>'
            f'<path class="edge-hit" data-edge-id="{safe_text(edge["id"])}" d="{path}" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke"/></g>'
        )
        if edge["style"] == "wireless":
            ox, oy = origin
            wireless_signals.append(
                f'<g class="wireless-signal" data-edge-id="{safe_text(edge["id"])}" transform="translate({ox:.1f} {oy:.1f}) rotate({angle:.1f})">'
                '<path d="M 8 -15 Q 22 0 8 15"/><path d="M 16 -23 Q 37 0 16 23"/></g>'
            )
        if edge["label"]:
            label_width = max(64, min(156, len(edge["label"]) * 9 + 26))
            labels.append(
                f'<g class="edge-label" id="{safe_id(edge["id"], "edge-label")}" data-edge-id="{safe_text(edge["id"])}"><rect x="{lx - label_width / 2:.1f}" y="{ly - 13:.1f}" width="{label_width:.1f}" height="26" rx="5"/>'
                f'<text x="{lx:.1f}" y="{ly + 4:.1f}" text-anchor="middle">{safe_text(edge["label"])}</text></g>'
            )
    node_hit_markup: list[str] = []
    node_markup: list[str] = []
    for node in model["nodes"]:
        x, y = node["x"], node["y"]
        radius = node_radius(node)
        hit_radius = radius + (9 if node.get("compact") else 10)
        icon_size = 26 if node["compact"] else 36
        icon_y = -27 if node["compact"] else -34
        compact = " compact" if node["compact"] else ""
        node_hit_markup.append(f'<circle class="node-hit" data-node-id="{safe_text(node["id"])}" cx="{x:.1f}" cy="{y:.1f}" r="{hit_radius:.1f}" fill="transparent" stroke="none" pointer-events="all"/>')
        node_markup.append(
            f'<g class="node {node["status"]}{compact}" id="{safe_id(node["id"], "node")}" data-node-id="{safe_text(node["id"])}" transform="translate({x:.1f} {y:.1f})">'
            f'<circle r="{radius:.1f}"/><svg x="{-icon_size / 2:.1f}" y="{icon_y:.1f}" width="{icon_size}" height="{icon_size}" viewBox="0 0 64 64"><use href="#icon-{node["type"]}"/></svg>'
            f'{label_markup(node)}</g>'
        )
    title_id = safe_id(model["title"], "topology-title")
    desc_id = safe_id(model["title"], "topology-desc")
    description = f"{len(model['nodes'])} devices and {len(model['edges'])} connections arranged as a structured network topology."
    return f'''<svg id="topology-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.1f} {height:.1f}" role="img" aria-labelledby="{title_id} {desc_id}">
  <title id="{title_id}">{safe_text(model["title"])}</title>
  <desc id="{desc_id}">{safe_text(description)}</desc>
  <defs>{icon_defs()}<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
  <g id="viewport"><rect class="canvas-background" width="{width:.1f}" height="{height:.1f}"/>{groups}<g class="edges">{''.join(edge_markup)}</g><g class="wireless-signals">{''.join(wireless_signals)}</g><g class="node-hits">{''.join(node_hit_markup)}</g><g class="edge-labels">{''.join(labels)}</g><g class="nodes">{''.join(node_markup)}</g></g>
</svg>'''


def safe_json(model: dict[str, Any]) -> str:
    # Do not expose automatic-layout bookkeeping in the portable model.
    export_model = json.loads(json.dumps(model, ensure_ascii=False))
    for group in export_model.get("groups", []):
        if isinstance(group, dict):
            group.pop("_layout_box", None)
    return json.dumps(export_model, ensure_ascii=False, indent=2).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def editor_styles() -> str:
    return r'''
.editor-action { display:none; }
.app[data-mode="edit"] .editor-action { display:inline-flex; align-items:center; justify-content:center; }
.app[data-mode="edit"] #topology-svg { cursor:crosshair; }
.app[data-mode="edit"] .node { cursor:move; }
.app[data-mode="edit"] .group rect { cursor:move; }
.app[data-mode="edit"] .edge-hit { cursor:pointer; }
.edge-hit { pointer-events:stroke; }
.edge-item:hover > .edge { stroke:var(--blue); stroke-width:2.3; }
.node-hit { pointer-events:all; cursor:move; }
button[data-action="edit"] { width:42px; font-size:11px; font-weight:700; letter-spacing:.04em; }
button[data-action="edit"].active { color:var(--blue); border-color:var(--blue); background:var(--group); }
.editor-status { min-width:48px; color:var(--muted); font:600 10px/1 Bahnschrift,Arial,sans-serif; letter-spacing:.12em; text-align:center; }
.node.editor-selected circle { stroke:var(--blue); stroke-width:2.3; }
.edge.editor-selected { stroke:var(--blue); stroke-width:2.2; }
.group.editor-selected rect { stroke:var(--blue); stroke-width:1.8; }
.edge-label { cursor:move; }
.edge-label.editor-selected rect { fill:var(--group); stroke:var(--blue); stroke-width:2; }
.edge-label.editor-selected text { fill:var(--blue); }
.editor-overlay { pointer-events:none; }
.route-handle { pointer-events:all; fill:var(--surface); stroke:var(--blue); stroke-width:2; cursor:move; }
.route-handle:hover { fill:var(--blue); }
.endpoint-handle { pointer-events:all; fill:var(--surface); stroke:var(--blue); stroke-width:1.6; opacity:.82; cursor:crosshair; }
.endpoint-handle.is-active { fill:var(--blue); stroke:var(--surface); stroke-width:2; opacity:1; }
.endpoint-handle:hover { fill:var(--surface); stroke:var(--blue); stroke-width:2.2; opacity:1; }
@media (prefers-reduced-motion: reduce) { .route-handle, .node, .edge { transition:none !important; } }
'''


def editor_script() -> str:
    return r'''<script>(() => {
  const app = document.querySelector('.app');
  const svg = document.querySelector('#topology-svg');
  const viewport = document.querySelector('#viewport');
  const modelElement = document.querySelector('#topology-model');
  const editButton = document.querySelector('[data-action="edit"]');
  const statusElement = document.querySelector('.editor-status');
  if (!app || !svg || !viewport || !modelElement || !editButton) return;

  const model = JSON.parse(modelElement.textContent || '{}');
  const grid = () => Number(model.canvas?.snap || model.canvas?.grid || 24);
  const snap = value => Math.round(Number(value) / grid()) * grid();
  const nodeById = id => model.nodes.find(node => node.id === id);
  const groupById = id => model.groups.find(group => group.id === id);
  const edgeById = id => model.edges.find(edge => edge.id === id);
  const nodeElement = id => document.querySelector(`[data-node-id="${CSS.escape(id)}"].node`);
  const nodeHitElement = id => document.querySelector(`[data-node-id="${CSS.escape(id)}"].node-hit`);
  const groupElement = id => document.querySelector(`[data-group-id="${CSS.escape(id)}"]`);
  const edgeElement = id => document.querySelector(`[data-edge-id="${CSS.escape(id)}"].edge`);
  const labelElement = id => document.querySelector(`[data-edge-id="${CSS.escape(id)}"].edge-label`);
  const wirelessSignalElement = id => document.querySelector(`[data-edge-id="${CSS.escape(id)}"].wireless-signal`);
  const radius = node => node?.compact ? 32 : 42;
  const anchorOrder = ['right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right'];
  const anchorVectors = {
    right: [1, 0], 'bottom-right': [Math.SQRT1_2, Math.SQRT1_2], bottom: [0, 1], 'bottom-left': [-Math.SQRT1_2, Math.SQRT1_2],
    left: [-1, 0], 'top-left': [-Math.SQRT1_2, -Math.SQRT1_2], top: [0, -1], 'top-right': [Math.SQRT1_2, -Math.SQRT1_2],
  };
  const selectedClass = 'editor-selected';
  let editing = false;
  let selection = null;
  let gesture = null;
  let undoStack = [];
  let redoStack = [];
  let overlay = document.querySelector('#editor-overlay');

  if (!overlay) {
    overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    overlay.id = 'editor-overlay';
    overlay.classList.add('editor-overlay');
    viewport.appendChild(overlay);
  }

  const copyModel = () => JSON.stringify(model);
  const restoreModel = snapshot => {
    const restored = JSON.parse(snapshot);
    Object.keys(model).forEach(key => delete model[key]);
    Object.assign(model, restored);
    model.canvas.layout = 'manual';
    renderAll();
  };
  const commit = before => {
    if (!before || before === copyModel()) return;
    undoStack.push(before);
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  };
  const undo = () => {
    if (!undoStack.length) return;
    redoStack.push(copyModel());
    restoreModel(undoStack.pop());
    setStatus('UNDO');
  };
  const redo = () => {
    if (!redoStack.length) return;
    undoStack.push(copyModel());
    restoreModel(redoStack.pop());
    setStatus('REDO');
  };
  const setStatus = value => { if (statusElement) statusElement.textContent = value; };
  const ensureManual = () => {
    model.canvas.layout = 'manual';
    model.canvas.editable = true;
    model.groups.forEach(group => { materializeGroupBounds(group); delete group._layout_box; });
  };
  const clearSelection = () => {
    document.querySelectorAll('.editor-selected').forEach(element => element.classList.remove(selectedClass));
    selection = null;
    overlay.replaceChildren();
  };
  const select = (kind, id) => {
    clearSelection();
    selection = { kind, id };
    const element = kind === 'node' ? nodeElement(id) : kind === 'group' ? groupElement(id) : kind === 'edge' ? edgeElement(id) : labelElement(id);
    element?.classList.add(selectedClass);
    drawHandles();
  };
  const pointFromEvent = event => {
    const matrix = viewport.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const world = point.matrixTransform(matrix.inverse());
    return { x: snap(world.x), y: snap(world.y) };
  };
  const boundary = (node, other, anchor = null) => {
    const r = radius(node);
    const vector = anchorVectors[anchor];
    if (vector) return { x: node.x + vector[0] * r, y: node.y + vector[1] * r };
    const dx = other.x - node.x;
    const dy = other.y - node.y;
    if (Math.abs(dx) >= Math.abs(dy)) return { x: node.x + (dx >= 0 ? r : -r), y: node.y };
    return { x: node.x, y: node.y + (dy >= 0 ? r : -r) };
  };
  const autoAnchor = (node, other) => {
    const dx = other.x - node.x;
    const dy = other.y - node.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  };
  const anchorFromPoint = (node, point) => {
    const dx = point.x - node.x;
    const dy = point.y - node.y;
    const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return anchorOrder[(octant % anchorOrder.length + anchorOrder.length) % anchorOrder.length];
  };
  const midpoint = points => {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };
    const lengths = points.slice(0, -1).map((point, index) => Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y));
    let distance = lengths.reduce((sum, value) => sum + value, 0) / 2;
    for (let index = 0; index < lengths.length; index += 1) {
      const length = lengths[index];
      if (distance <= length || index === lengths.length - 1) {
        const start = points[index];
        const end = points[index + 1];
        const ratio = length ? distance / length : 0;
        return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
      }
      distance -= length;
    }
    return points[points.length - 1];
  };
  const orthogonalPoints = (start, end, waypoints) => {
    const points = [start];
    waypoints.forEach(next => {
      const current = points[points.length - 1];
      const bend = Math.abs(next.x - current.x) >= Math.abs(next.y - current.y) ? { x: next.x, y: current.y } : { x: current.x, y: next.y };
      if (bend.x !== current.x || bend.y !== current.y) points.push(bend);
      if (next.x !== points[points.length - 1].x || next.y !== points[points.length - 1].y) points.push(next);
    });
    const current = points[points.length - 1];
    const bend = Math.abs(end.x - current.x) >= Math.abs(end.y - current.y) ? { x: end.x, y: current.y } : { x: current.x, y: end.y };
    if (bend.x !== current.x || bend.y !== current.y) points.push(bend);
    if (end.x !== points[points.length - 1].x || end.y !== points[points.length - 1].y) points.push(end);
    return points;
  };
  const quadraticPoint = (start, control, end, t = .5) => {
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
  };
  const roundedPolyline = (rawPoints, radius = 8) => {
    const points = rawPoints.filter((point, index, items) => !index || point.x !== items[index - 1].x || point.y !== items[index - 1].y);
    if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : '';
    const commands = [`M ${points[0].x} ${points[0].y}`];
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const following = points[index + 1];
      const incoming = Math.hypot(current.x - previous.x, current.y - previous.y);
      const outgoing = Math.hypot(following.x - current.x, following.y - current.y);
      if (incoming < .01 || outgoing < .01) { commands.push(`L ${current.x} ${current.y}`); continue; }
      const corner = Math.min(radius, incoming / 2, outgoing / 2);
      const inUnit = { x: (current.x - previous.x) / incoming, y: (current.y - previous.y) / incoming };
      const outUnit = { x: (following.x - current.x) / outgoing, y: (following.y - current.y) / outgoing };
      const before = { x: current.x - inUnit.x * corner, y: current.y - inUnit.y * corner };
      const after = { x: current.x + outUnit.x * corner, y: current.y + outUnit.y * corner };
      commands.push(`L ${before.x} ${before.y}`, `Q ${current.x} ${current.y} ${after.x} ${after.y}`);
    }
    commands.push(`L ${points[points.length - 1].x} ${points[points.length - 1].y}`);
    return commands.join(' ');
  };
  const pathData = edge => {
    const source = nodeById(edge.source);
    const target = nodeById(edge.target);
    if (!source || !target) return { d: '', label: { x: 0, y: 0 }, handlePoints: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, angle: 0 };
    const start = boundary(source, target, edge.source_anchor);
    const end = boundary(target, source, edge.target_anchor);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    const waypoints = Array.isArray(edge.waypoints) ? edge.waypoints : [];
    if (edge.style === 'curved' || edge.style === 'wireless') {
      const midX = (start.x + end.x) / 2;
      const bow = Math.max(48, Math.min(132, Math.abs(end.x - start.x) * .24 + Math.abs(end.y - start.y) * .16));
      const control = waypoints[0] || { x: midX, y: (start.y + end.y) / 2 - (start.y <= end.y ? bow : -bow) };
      const handlePoints = waypoints.length ? waypoints : [quadraticPoint(start, control, end)];
      return { d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, label: control, handlePoints, start, end, angle };
    }
    if (edge.style === 'straight') {
      const points = [start, ...waypoints, end];
      return { d: waypoints.length ? roundedPolyline(points) : points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '), label: midpoint(points), handlePoints: waypoints.length ? waypoints : [midpoint(points)], start, end, angle };
    }
    const points = orthogonalPoints(start, end, waypoints);
    const handlePoints = waypoints.length ? waypoints : points.length > 2 ? [points[1]] : [midpoint(points)];
    return { d: roundedPolyline(points), label: midpoint(points), handlePoints, start, end, angle };
  };
  const labelBase = geometry => {
    const radians = geometry.angle * Math.PI / 180;
    return Math.abs(Math.cos(radians)) >= Math.abs(Math.sin(radians))
      ? { x: geometry.label.x, y: geometry.label.y - 18 }
      : { x: geometry.label.x + 18, y: geometry.label.y };
  };
  const setLabelPosition = (edge, position) => {
    const label = labelElement(edge.id);
    if (!label) return;
    const geometry = pathData(edge);
    const offset = edge.label_offset || { x: 0, y: 0 };
    const base = labelBase(geometry);
    const x = base.x + Number(offset.x || 0);
    const y = base.y + Number(offset.y || 0);
    const rect = label.querySelector('rect');
    const text = label.querySelector('text');
    if (!rect || !text) return;
    const width = Number(rect.getAttribute('width') || 64);
    rect.setAttribute('x', String(x - width / 2));
    rect.setAttribute('y', String(y - 13));
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y + 4));
  };
  const renderAll = () => {
    model.nodes.forEach(node => {
      nodeElement(node.id)?.setAttribute('transform', `translate(${node.x} ${node.y})`);
      nodeHitElement(node.id)?.setAttribute('cx', String(node.x));
      nodeHitElement(node.id)?.setAttribute('cy', String(node.y));
    });
    model.groups.forEach(group => {
      const element = groupElement(group.id);
      const box = element?.querySelector('rect');
      const mask = element?.querySelector('.group-label-mask');
      const title = element?.querySelector('text');
      if (!box || group.x == null || group.y == null) return;
      box.setAttribute('x', String(group.x));
      box.setAttribute('y', String(group.y));
      box.setAttribute('width', String(group.width));
      box.setAttribute('height', String(group.height));
      mask?.setAttribute('x', String(group.x + 16));
      mask?.setAttribute('y', String(group.y + 12));
      title?.setAttribute('x', String(group.x + 28));
      title?.setAttribute('y', String(group.y + 31));
    });
    model.edges.forEach(edge => {
      const geometry = pathData(edge);
      edgeElement(edge.id)?.setAttribute('d', geometry.d);
      setLabelPosition(edge, geometry.label);
      if (edge.style === 'wireless') wirelessSignalElement(edge.id)?.setAttribute('transform', `translate(${geometry.start.x} ${geometry.start.y}) rotate(${geometry.angle})`);
    });
    drawHandles();
  };
  const materializeGroupBounds = group => {
    if (group.x != null && group.y != null && group.width != null && group.height != null) return;
    const box = groupElement(group.id)?.querySelector('rect');
    const cached = group._layout_box;
    group.x = Number(box?.getAttribute('x') ?? cached?.x ?? 0);
    group.y = Number(box?.getAttribute('y') ?? cached?.y ?? 0);
    group.width = Number(box?.getAttribute('width') ?? cached?.w ?? 280);
    group.height = Number(box?.getAttribute('height') ?? cached?.h ?? 320);
  };
  const drawHandles = () => {
    overlay.replaceChildren();
    if (!editing || !selection || selection.kind !== 'edge') return;
    const edge = edgeById(selection.id);
    if (!edge || edge.locked) return;
    const geometry = pathData(edge);
    [
      { endpoint: 'source', node: nodeById(edge.source), other: nodeById(edge.target) },
      { endpoint: 'target', node: nodeById(edge.target), other: nodeById(edge.source) },
    ].forEach(({ endpoint, node, other }) => {
      if (!node || !other) return;
      const anchorKey = endpoint === 'source' ? 'source_anchor' : 'target_anchor';
      const activeAnchor = edge[anchorKey] || autoAnchor(node, other);
      anchorOrder.forEach(anchor => {
        const point = boundary(node, other, anchor);
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.classList.add('endpoint-handle');
        if (anchor === activeAnchor) handle.classList.add('is-active');
        handle.setAttribute('r', anchor === activeAnchor ? '6' : '4.5');
        handle.setAttribute('cx', String(point.x));
        handle.setAttribute('cy', String(point.y));
        handle.dataset.edgeId = edge.id;
        handle.dataset.handleType = 'anchor';
        handle.dataset.endpoint = endpoint;
        handle.dataset.anchor = anchor;
        overlay.appendChild(handle);
      });
    });
    geometry.handlePoints.forEach((point, index) => {
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.classList.add('route-handle');
      handle.setAttribute('r', '7');
      handle.setAttribute('cx', String(point.x));
      handle.setAttribute('cy', String(point.y));
      handle.dataset.edgeId = edge.id;
      handle.dataset.index = String(index);
      if (!edge.waypoints?.length) handle.dataset.virtual = 'true';
      overlay.appendChild(handle);
    });
  };
  const setEditing = value => {
    editing = Boolean(value);
    if (editing) ensureManual();
    app.dataset.mode = editing ? 'edit' : 'view';
    editButton.classList.toggle('active', editing);
    setStatus(editing ? 'EDIT' : 'VIEW');
    if (!editing) { gesture = null; clearSelection(); }
    else drawHandles();
  };
  const beginGesture = (kind, id, event, index = null, endpoint = null) => {
    const point = pointFromEvent(event);
    const target = kind === 'node' ? nodeById(id) : kind === 'group' ? groupById(id) : edgeById(id);
    if (!target || target.locked) return;
    let origin = null;
    let members = null;
    if (kind === 'node') origin = { x: target.x, y: target.y };
    if (kind === 'group') {
      materializeGroupBounds(target);
      origin = { x: target.x, y: target.y };
      members = model.nodes.filter(node => node.group === target.id).map(node => ({ id: node.id, x: node.x, y: node.y }));
    }
    const before = copyModel();
    gesture = { kind, id, index, endpoint, point, before, origin, members, changed: false };
    event.preventDefault();
    event.stopPropagation();
    svg.setPointerCapture?.(event.pointerId);
  };
  const moveGesture = (event) => {
    if (!gesture) return;
    const point = pointFromEvent(event);
    const delta = { x: point.x - gesture.point.x, y: point.y - gesture.point.y };
    if (delta.x === 0 && delta.y === 0) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (gesture.kind === 'node') {
      const node = nodeById(gesture.id);
      if (node) { node.x = snap(gesture.origin.x + delta.x); node.y = snap(gesture.origin.y + delta.y); }
    } else if (gesture.kind === 'group') {
      const group = groupById(gesture.id);
      if (group) {
        group.x = snap(gesture.origin.x + delta.x);
        group.y = snap(gesture.origin.y + delta.y);
        gesture.members.forEach(member => { const node = nodeById(member.id); if (node) { node.x = snap(member.x + delta.x); node.y = snap(member.y + delta.y); } });
      }
    } else if (gesture.kind === 'anchor') {
      const edge = edgeById(gesture.id);
      if (edge) {
        const node = nodeById(gesture.endpoint === 'source' ? edge.source : edge.target);
        if (node) edge[gesture.endpoint === 'source' ? 'source_anchor' : 'target_anchor'] = anchorFromPoint(node, point);
      }
    } else if (gesture.kind === 'route') {
      const edge = edgeById(gesture.id);
      if (edge) {
        edge.waypoints = Array.isArray(edge.waypoints) ? edge.waypoints : [];
        if (gesture.index >= edge.waypoints.length) edge.waypoints.push({ x: point.x, y: point.y });
        else edge.waypoints[gesture.index] = { x: point.x, y: point.y };
        if (edge.style === 'straight') edge.style = 'orthogonal';
      }
    } else if (gesture.kind === 'label') {
      const edge = edgeById(gesture.id);
      if (edge) {
        const geometry = pathData(edge);
        const base = labelBase(geometry);
        edge.label_offset = { x: snap(point.x - base.x), y: snap(point.y - base.y) };
      }
    }
    gesture.changed = true;
    renderAll();
    event.preventDefault();
    event.stopPropagation();
  };
  const endGesture = event => {
    if (!gesture) return;
    commit(gesture.before);
    gesture = null;
    setStatus('EDIT');
    event?.preventDefault();
    event?.stopPropagation();
  };
  const downloadFile = (name, type, data) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([data], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  const updateModelScript = () => { modelElement.textContent = JSON.stringify(model, null, 2).replace(/[<>&]/g, char => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' }[char])); };
  const saveHtml = () => {
    ensureManual();
    updateModelScript();
    downloadFile(`${model.title || 'topology'}-edited.html`, 'text/html;charset=utf-8', '<!doctype html>\n' + document.documentElement.outerHTML);
    setStatus('SAVED');
  };
  const saveJson = () => { ensureManual(); updateModelScript(); downloadFile(`${model.title || 'topology'}-model.json`, 'application/json;charset=utf-8', JSON.stringify(model, null, 2)); setStatus('JSON'); };

  svg.addEventListener('pointerdown', event => {
    if (!editing) return;
    const endpointHandle = event.target.closest?.('.endpoint-handle');
    const handle = event.target.closest?.('.route-handle');
    const nodeHit = event.target.closest?.('.node-hit');
    const node = event.target.closest?.('.node');
    const label = event.target.closest?.('.edge-label');
    const edgeHit = event.target.closest?.('.edge-hit');
    const edge = event.target.closest?.('.edge');
    const group = event.target.closest?.('.group');
    if (endpointHandle) {
      select('edge', endpointHandle.dataset.edgeId);
      const edgeTarget = edgeById(endpointHandle.dataset.edgeId);
      const anchorKey = endpointHandle.dataset.endpoint === 'source' ? 'source_anchor' : 'target_anchor';
      if (edgeTarget && endpointHandle.dataset.anchor && edgeTarget[anchorKey] !== endpointHandle.dataset.anchor) {
        const before = copyModel();
        edgeTarget[anchorKey] = endpointHandle.dataset.anchor;
        commit(before);
        renderAll();
      }
      beginGesture('anchor', endpointHandle.dataset.edgeId, event, null, endpointHandle.dataset.endpoint);
    } else if (handle) {
      select('edge', handle.dataset.edgeId);
      beginGesture('route', handle.dataset.edgeId, event, Number(handle.dataset.index));
    } else if (nodeHit) {
      select('node', nodeHit.dataset.nodeId);
      beginGesture('node', nodeHit.dataset.nodeId, event);
    } else if (node) {
      select('node', node.dataset.nodeId);
      beginGesture('node', node.dataset.nodeId, event);
    } else if (label) {
      select('label', label.dataset.edgeId);
      beginGesture('label', label.dataset.edgeId, event);
    } else if (edgeHit || edge) {
      select('edge', (edgeHit || edge).dataset.edgeId);
      event.preventDefault();
      event.stopPropagation();
    } else if (group) {
      select('group', group.dataset.groupId);
      beginGesture('group', group.dataset.groupId, event);
    } else {
      clearSelection();
    }
  }, true);
  svg.addEventListener('pointermove', moveGesture, true);
  svg.addEventListener('pointerup', endGesture, true);
  svg.addEventListener('pointercancel', endGesture, true);
  document.addEventListener('keydown', event => {
    if (!editing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    if (event.key === 'Escape') setEditing(false);
  });
  document.querySelector('.controls')?.addEventListener('click', event => {
    const action = event.target.closest?.('button')?.dataset.action;
    if (!action) return;
    if (action === 'edit') setEditing(!editing);
    if (action === 'undo') undo();
    if (action === 'redo') redo();
    if (action === 'save-html') saveHtml();
    if (action === 'save-json') saveJson();
  });
  model.canvas.editable = model.canvas.editable !== false;
  renderAll();
  setEditing(false);
})();</script>'''


def render_html(model: dict[str, Any]) -> str:
    svg = render_svg(model)
    title = safe_text(model["title"])
    theme = model["canvas"]["theme"]
    template = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>__TITLE__</title>
<style>
:root { color-scheme: light dark; font-family: "Bahnschrift", "Aptos Display", "Segoe UI", Arial, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
.app { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
.app[data-theme="light"] { --page:#f3f6f9; --surface:#ffffff; --canvas:#fbfcfe; --ink:#1e2a36; --muted:#667585; --line:#9eafbf; --border:#d6dfe8; --group:#f6f9fc; --group-stroke:#c8d4df; --icon:#405466; --blue:#2f6eaa; --amber:#b7791f; --red:#bf5353; --standby:#71809a; }
.app[data-theme="dark"] { --page:#111a24; --surface:#18232e; --canvas:#121c26; --ink:#e4ebf2; --muted:#9aaabd; --line:#65798c; --border:#314356; --group:#172532; --group-stroke:#40576b; --icon:#b8c5d1; --blue:#72a9dc; --amber:#e2ad58; --red:#e87878; --standby:#a4b0c2; }
.toolbar { min-height:60px; padding:10px 18px; display:flex; align-items:center; gap:14px; background:var(--surface); border-bottom:1px solid var(--border); color:var(--ink); }
.title { min-width:0; flex:1; font-size:16px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.controls { display:flex; align-items:center; gap:6px; }
button { width:34px; height:34px; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--ink); font:inherit; font-size:17px; line-height:1; cursor:pointer; }
button.export { width:42px; font-size:11px; font-weight:700; } button:hover { background:var(--group); border-color:var(--line); }
.canvas-wrap { overflow:hidden; position:relative; padding:20px; background:var(--page); }
#topology-svg { width:100%; height:calc(100vh - 100px); min-height:440px; display:block; background:var(--canvas); border:1px solid var(--border); cursor:grab; user-select:none; touch-action:none; }
#topology-svg.is-panning { cursor:grabbing; }.canvas-background { fill:var(--canvas); }
.group rect { fill:var(--group); stroke:var(--group-stroke); stroke-width:1; }.group .group-label-mask { stroke:none; }.group text { fill:var(--muted); font-family:"Cascadia Mono", "Consolas", monospace; font-size:13px; font-weight:600; letter-spacing:.55px; }
.edge { fill:none; stroke:var(--line); stroke-width:1.25; stroke-linecap:round; stroke-linejoin:round; }.edge.highlight { stroke:var(--blue); stroke-width:2; }.edge.warning { stroke:var(--amber); stroke-width:1.9; stroke-dasharray:7 6; }.edge.alert,.edge.failure { stroke:var(--red); stroke-width:1.9; stroke-dasharray:7 5; }.edge.standby { stroke:var(--standby); stroke-width:1.45; stroke-dasharray:3 6; }.edge.heartbeat { stroke-width:1.25; stroke-dasharray:2 5; }.edge.wireless { stroke:var(--blue); stroke-width:1.45; stroke-dasharray:2 8; }.edge.wireless.highlight { stroke-width:1.9; }
.wireless-signal path { fill:none; stroke:var(--blue); stroke-width:1.3; stroke-linecap:round; }.edge-label rect { fill:var(--surface); stroke:var(--border); }.edge-label text { fill:var(--muted); font-family:"Cascadia Mono", "Consolas", monospace; font-size:10px; font-weight:500; letter-spacing:.2px; }
.node circle { fill:var(--surface); stroke:var(--border); stroke-width:1.1; }.node svg { fill:none; stroke:var(--icon); stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }.node text { fill:var(--ink); font-family:"Bahnschrift", "Segoe UI", Arial, sans-serif; font-weight:700; letter-spacing:.3px; }.node.highlight circle { stroke:var(--blue); stroke-width:1.8; }.node.highlight svg { stroke:var(--blue); }.node.warning circle { stroke:var(--amber); stroke-width:1.8; }.node.warning svg { stroke:var(--amber); }.node.alert circle,.node.failure circle { stroke:var(--red); stroke-width:1.8; }.node.alert svg,.node.failure svg { stroke:var(--red); }.node.standby circle { stroke:var(--standby); stroke-width:1.35; stroke-dasharray:4 3; }.node.standby svg { stroke:var(--standby); } #arrow path { fill:var(--line); }
@media (max-width:560px) { .toolbar { min-height:106px; padding:9px 12px; gap:6px; flex-wrap:wrap; align-content:center; }.title { flex:1 0 100%; }.controls { width:100%; justify-content:center; gap:3px; }.canvas-wrap { overflow:auto; padding:10px; } #topology-svg { width:960px; max-width:none; height:calc(100vh - 126px); min-height:440px; } }
</style></head><body><main class="app" data-theme="__THEME__"><header class="toolbar"><div class="title">__TITLE__</div><div class="controls"><button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out">-</button><button type="button" data-action="reset" aria-label="Reset view" title="Reset view">&#8634;</button><button type="button" data-action="theme" aria-label="Toggle theme" title="Toggle light or dark theme">&#9680;</button><button type="button" data-action="fullscreen" aria-label="Fullscreen" title="Fullscreen">&#9974;</button><button class="export" type="button" data-action="svg" aria-label="Download SVG" title="Download SVG">SVG</button><button class="export" type="button" data-action="png" aria-label="Download PNG" title="Download PNG">PNG</button></div></header><section class="canvas-wrap">__SVG__</section></main><script id="topology-model" type="application/json">__MODEL__</script>
<script>(() => { const app=document.querySelector('.app'),svg=document.querySelector('#topology-svg'),viewport=document.querySelector('#viewport'),model=JSON.parse(document.querySelector('#topology-model').textContent); let scale=1,panX=0,panY=0,drag=null; const apply=()=>viewport.setAttribute('transform',`translate(${panX} ${panY}) scale(${scale})`),zoom=amount=>{scale=Math.max(.45,Math.min(2.5,scale+amount));apply()},download=(name,type,data)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0)},exportSvg=()=>{const copy=svg.cloneNode(true),css=getComputedStyle(app),color=name=>css.getPropertyValue(name).trim(),style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=`.canvas-background{fill:${color('--canvas')}}.group rect{fill:${color('--group')};stroke:${color('--group-stroke')};stroke-width:1}.group text{fill:${color('--muted')};font:700 15px Bahnschrift,Arial}.edge{fill:none;stroke:${color('--line')};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.edge.highlight{stroke:${color('--blue')};stroke-width:2.3}.edge.warning{stroke:${color('--amber')};stroke-width:2.1;stroke-dasharray:7 6}.edge.alert,.edge.failure{stroke:${color('--red')};stroke-width:2.1;stroke-dasharray:7 5}.edge.standby{stroke:${color('--standby')};stroke-width:1.7;stroke-dasharray:3 6}.edge.wireless{stroke:${color('--blue')};stroke-width:1.7;stroke-dasharray:2 8}.wireless-signal path{fill:none;stroke:${color('--blue')};stroke-width:1.5}.edge-label rect{fill:${color('--surface')};stroke:${color('--border')}}.edge-label text{fill:${color('--muted')};font:600 12px Bahnschrift,Arial}.node circle{fill:${color('--surface')};stroke:${color('--border')};stroke-width:1.2}.node svg{fill:none;stroke:${color('--icon')};stroke-width:2.2}.node text{fill:${color('--ink')};font:700 11px Bahnschrift,Arial}.node.highlight circle{stroke:${color('--blue')};stroke-width:2}.node.highlight svg{stroke:${color('--blue')}}.node.warning circle{stroke:${color('--amber')};stroke-width:2}.node.warning svg{stroke:${color('--amber')}}.node.alert circle,.node.failure circle{stroke:${color('--red')};stroke-width:2}.node.alert svg,.node.failure svg{stroke:${color('--red')}}.node.standby circle{stroke:${color('--standby')};stroke-width:1.5;stroke-dasharray:4 3}.node.standby svg{stroke:${color('--standby')}}#arrow path{fill:${color('--line')}}`;copy.insertBefore(style,copy.firstChild);copy.querySelector('#viewport').removeAttribute('transform');return new XMLSerializer().serializeToString(copy)};document.querySelector('.controls').addEventListener('click',event=>{const action=event.target.closest('button')?.dataset.action;if(!action)return;if(action==='zoom-in')zoom(.15);if(action==='zoom-out')zoom(-.15);if(action==='reset'){scale=1;panX=0;panY=0;apply()}if(action==='theme')app.dataset.theme=app.dataset.theme==='dark'?'light':'dark';if(action==='fullscreen')(document.fullscreenElement?document.exitFullscreen():document.querySelector('.canvas-wrap').requestFullscreen());if(action==='svg')download(`${model.title||'topology'}.svg`,'image/svg+xml;charset=utf-8',exportSvg());if(action==='png'){const source=exportSvg(),image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=svg.viewBox.baseVal.width*2;c.height=svg.viewBox.baseVal.height*2;const ctx=c.getContext('2d');ctx.fillStyle=getComputedStyle(app).getPropertyValue('--canvas');ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);c.toBlob(blob=>download(`${model.title||'topology'}.png`,'image/png',blob));URL.revokeObjectURL(image.src)};image.src=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}))}});svg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY>0?-.1:.1)},{passive:false});svg.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,px:panX,py:panY};svg.setPointerCapture(event.pointerId);svg.classList.add('is-panning')});svg.addEventListener('pointermove',event=>{if(!drag)return;const box=svg.getBoundingClientRect();panX=drag.px+(event.clientX-drag.x)*model.canvas.width/box.width;panY=drag.py+(event.clientY-drag.y)*model.canvas.height/box.height;apply()});const stop=()=>{drag=null;svg.classList.remove('is-panning')};svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop)})();</script></body></html>'''
    output = template.replace("__TITLE__", title).replace("__THEME__", theme).replace("__SVG__", svg).replace("__MODEL__", safe_json(model))
    editor_toolbar = ''
    if model["canvas"].get("editable", True):
        editor_toolbar = '<button type="button" data-action="edit" aria-label="Edit topology" title="Edit topology">Edit</button><button class="editor-action" type="button" data-action="undo" aria-label="Undo" title="Undo">&#8630;</button><button class="editor-action" type="button" data-action="redo" aria-label="Redo" title="Redo">&#8631;</button><button class="editor-action export" type="button" data-action="save-html" aria-label="Save updated HTML" title="Download updated HTML">HTML</button><button class="editor-action export" type="button" data-action="save-json" aria-label="Save topology JSON" title="Download topology JSON">JSON</button><span class="editor-status" aria-live="polite">VIEW</span>'
    output = output.replace('<div class="controls">', f'<div class="controls">{editor_toolbar}', 1)
    output = output.replace('</style>', editor_styles() + '</style>', 1)
    # Keep exported SVG line weights aligned with the interactive canvas.
    export_style_updates = (
        (".group rect{fill:${color('--group')};stroke:${color('--group-stroke')};stroke-width:1}.group text{fill:${color('--muted')};font:700 15px Bahnschrift,Arial}", ".group rect{fill:${color('--group')};stroke:${color('--group-stroke')};stroke-width:1}.group .group-label-mask{fill:${color('--group')};stroke:none}.group text{fill:${color('--muted')};font:600 13px 'Cascadia Mono','Consolas',monospace;letter-spacing:.55px}"),
        (".edge{fill:none;stroke:${color('--line')};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.edge.highlight{stroke:${color('--blue')};stroke-width:2.3}.edge.warning{stroke:${color('--amber')};stroke-width:2.1;stroke-dasharray:7 6}.edge.alert,.edge.failure{stroke:${color('--red')};stroke-width:2.1;stroke-dasharray:7 5}.edge.standby{stroke:${color('--standby')};stroke-width:1.7;stroke-dasharray:3 6}.edge.wireless{stroke:${color('--blue')};stroke-width:1.7;stroke-dasharray:2 8}", ".edge{fill:none;stroke:${color('--line')};stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round}.edge.highlight{stroke:${color('--blue')};stroke-width:2}.edge.warning{stroke:${color('--amber')};stroke-width:1.9;stroke-dasharray:7 6}.edge.alert,.edge.failure{stroke:${color('--red')};stroke-width:1.9;stroke-dasharray:7 5}.edge.standby{stroke:${color('--standby')};stroke-width:1.45;stroke-dasharray:3 6}.edge.heartbeat{stroke-width:1.25;stroke-dasharray:2 5}.edge.wireless{stroke:${color('--blue')};stroke-width:1.45;stroke-dasharray:2 8}"),
        (".wireless-signal path{fill:none;stroke:${color('--blue')};stroke-width:1.5}.edge-label rect{fill:${color('--surface')};stroke:${color('--border')}}.edge-label text{fill:${color('--muted')};font:600 12px Bahnschrift,Arial}", ".wireless-signal path{fill:none;stroke:${color('--blue')};stroke-width:1.3}.edge-label rect{fill:${color('--surface')};stroke:${color('--border')}}.edge-label text{fill:${color('--muted')};font:500 10px 'Cascadia Mono','Consolas',monospace;letter-spacing:.2px}"),
        (".node circle{fill:${color('--surface')};stroke:${color('--border')};stroke-width:1.2}.node svg{fill:none;stroke:${color('--icon')};stroke-width:2.2}.node text{fill:${color('--ink')};font:700 11px Bahnschrift,Arial}.node.highlight circle{stroke:${color('--blue')};stroke-width:2}.node.highlight svg{stroke:${color('--blue')}}.node.warning circle{stroke:${color('--amber')};stroke-width:2}.node.warning svg{stroke:${color('--amber')}}.node.alert circle,.node.failure circle{stroke:${color('--red')};stroke-width:2}.node.alert svg,.node.failure svg{stroke:${color('--red')}}.node.standby circle{stroke:${color('--standby')};stroke-width:1.5;stroke-dasharray:4 3}.node.standby svg{stroke:${color('--standby')}}", ".node circle{fill:${color('--surface')};stroke:${color('--border')};stroke-width:1.1}.node svg{fill:none;stroke:${color('--icon')};stroke-width:1.7}.node text{fill:${color('--ink')};font:700 11px Bahnschrift,Arial}.node.highlight circle{stroke:${color('--blue')};stroke-width:1.8}.node.highlight svg{stroke:${color('--blue')}}.node.warning circle{stroke:${color('--amber')};stroke-width:1.8}.node.warning svg{stroke:${color('--amber')}}.node.alert circle,.node.failure circle{stroke:${color('--red')};stroke-width:1.8}.node.alert svg,.node.failure svg{stroke:${color('--red')}}.node.standby circle{stroke:${color('--standby')};stroke-width:1.35;stroke-dasharray:4 3}.node.standby svg{stroke:${color('--standby')}}"),
    )
    for original, replacement in export_style_updates:
        output = output.replace(original, replacement)
    output = output.replace('</body>', editor_script() + '</body>', 1)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a Topology Model JSON file to standalone HTML.")
    parser.add_argument("model", type=Path, help="Path to a Topology Model JSON file.")
    parser.add_argument("--output", "-o", type=Path, required=True, help="Destination HTML file.")
    parser.add_argument("--theme", choices=("light", "dark"), help="Override the model's initial theme.")
    args = parser.parse_args()
    try:
        model = normalize_model(load_model(args.model), args.theme)
        apply_enterprise_layout(model)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(render_html(model), encoding="utf-8")
    except (OSError, ValueError, json.JSONDecodeError, RuntimeError) as error:
        print(f"render_topology: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
