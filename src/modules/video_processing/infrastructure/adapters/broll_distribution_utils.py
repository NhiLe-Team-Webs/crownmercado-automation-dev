"""
B-Roll temporal distribution algorithm.

Ensures even spacing of B-roll moments across video timeline.
Promotes text overlays to B-roll if they fill critical gaps.
"""

import structlog
from src.modules.video_processing.domain.value_objects import (
    TextOverlay,
    TextOverlayMode,
    TextOverlayPosition,
)

logger = structlog.get_logger()


def analyze_distribution(
    overlays: list[TextOverlay],
    duration_seconds: float,
    target_broll_count: int = 7,
    max_gap_seconds: float = 90.0,
) -> dict:
    """
    Analyze overlay distribution and identify gaps.

    Args:
        overlays: List of TextOverlay objects
        duration_seconds: Total video duration
        target_broll_count: Target number of B-roll moments
        max_gap_seconds: Maximum acceptable gap without overlay

    Returns:
        {
            "gaps": [{"start_time": 13.6, "end_time": 105.12, "gap_seconds": 91.52, ...}],
            "target_spacing": 45.7,
            "current_broll_count": 4,
            "promotion_candidates": [...],
            "promotion_needed": 3,
            "coverage": {"start_0_30pct": True, "middle_30_70pct": False, ...}
        }
    """
    # Sort by start time
    sorted_overlays = sorted(overlays, key=lambda o: o.start)
    broll_moments = [o for o in sorted_overlays if o.mode == TextOverlayMode.B_ROLL_VIDEO]

    gaps = []
    for i in range(len(sorted_overlays) - 1):
        current_end = sorted_overlays[i].end
        next_start = sorted_overlays[i + 1].start
        gap_size = next_start - current_end

        if gap_size > max_gap_seconds:
            gaps.append(
                {
                    "start_time": current_end,
                    "end_time": next_start,
                    "gap_seconds": gap_size,
                    "after_index": i,
                    "before_index": i + 1,
                }
            )

    # Calculate target spacing
    target_spacing = duration_seconds / target_broll_count

    # Find promotion candidates (BOTTOM_TITLE/SIDE_PANEL in gap regions)
    candidates = []
    for gap in gaps:
        # Find overlays positioned in this gap zone
        for idx, overlay in enumerate(sorted_overlays):
            if overlay.start >= gap["start_time"] and overlay.start <= gap["end_time"]:
                if overlay.mode in [TextOverlayMode.BOTTOM_TITLE, TextOverlayMode.SIDE_PANEL]:
                    if overlay.spoken_context and len(overlay.spoken_context.strip()) >= 4:
                        candidates.append(
                            {
                                "index": idx,
                                "text": overlay.text,
                                "mode": overlay.mode.value,
                                "gap_key": f"{gap['start_time']:.1f}-{gap['end_time']:.1f}",
                                "quality_score_estimate": 0.5,
                            }
                        )

    # Coverage analysis
    mid_section_start = duration_seconds * 0.3
    mid_section_end = duration_seconds * 0.7
    mid_broll = [
        o
        for o in broll_moments
        if o.start >= mid_section_start and o.start <= mid_section_end
    ]

    return {
        "gaps": gaps,
        "gap_count": len(gaps),
        "target_spacing": target_spacing,
        "current_broll_count": len(broll_moments),
        "promotion_candidates": candidates,
        "promotion_needed": max(0, target_broll_count - len(broll_moments)),
        "coverage": {
            "start_0_30pct": len([o for o in broll_moments if o.start < mid_section_start]) > 0,
            "middle_30_70pct": len(mid_broll) > 0,
            "end_70_100pct": len([o for o in broll_moments if o.start > mid_section_end]) > 0,
        },
    }


def promote_for_distribution(
    overlays: list[TextOverlay],
    duration_seconds: float,
    target_broll_count: int = 7,
) -> list[TextOverlay]:
    """
    Promote text overlays to B-roll if they fill critical gaps.
    Modifies overlays in-place and returns updated list.

    Args:
        overlays: List of TextOverlay objects
        duration_seconds: Total video duration
        target_broll_count: Target number of B-roll moments

    Returns:
        Modified overlays list with promoted overlays changed to B_ROLL_VIDEO mode
    """
    analysis = analyze_distribution(overlays, duration_seconds, target_broll_count)

    logger.info(
        "Distribution analysis",
        gaps=analysis["gap_count"],
        current_broll=analysis["current_broll_count"],
        target_broll=target_broll_count,
        mid_section_coverage=analysis["coverage"]["middle_30_70pct"],
    )

    # If no gaps or already at target, return unchanged
    if not analysis["gaps"] or analysis["current_broll_count"] >= target_broll_count:
        return overlays

    # Promote best candidates
    promoted_count = 0
    for candidate in analysis["promotion_candidates"]:
        if promoted_count >= analysis["promotion_needed"]:
            break

        idx = candidate["index"]
        overlay = overlays[idx]

        # Preserve important fields
        original_text = overlay.text
        original_mode = overlay.mode.value

        # Upgrade mode
        overlay.mode = TextOverlayMode.B_ROLL_VIDEO
        overlay.position = TextOverlayPosition.BOTTOM_CENTER  # B-roll standard position

        logger.info(
            "Promoted overlay to B-roll for gap filling",
            text=original_text,
            previous_mode=original_mode,
            gap_key=candidate["gap_key"],
        )
        promoted_count += 1

    return overlays


def validate_distribution(
    overlays: list[TextOverlay],
    duration_seconds: float,
    target_broll_count: int = 7,
) -> dict:
    """
    Calculate distribution metrics and validate coverage.

    Args:
        overlays: List of TextOverlay objects
        duration_seconds: Total video duration
        target_broll_count: Target number of B-roll moments

    Returns:
        {
            "broll_count": 7,
            "target_count": 7,
            "gaps_seconds": [45.2, 48.1, 44.8],
            "avg_gap_seconds": 46.1,
            "variance_seconds": 2.3,
            "distribution_healthy": True,
            "issues": []
        }
    """
    sorted_overlays = sorted(overlays, key=lambda o: o.start)
    broll_moments = [o for o in sorted_overlays if o.mode == TextOverlayMode.B_ROLL_VIDEO]

    gaps = []
    for i in range(len(broll_moments) - 1):
        gap = broll_moments[i + 1].start - broll_moments[i].end
        gaps.append(gap)

    avg_gap = sum(gaps) / len(gaps) if gaps else 0
    variance = (sum((g - avg_gap) ** 2 for g in gaps) / len(gaps)) ** 0.5 if gaps else 0

    issues = []
    if len(broll_moments) < target_broll_count:
        issues.append(f"B-roll count {len(broll_moments)} < target {target_broll_count}")

    for gap in gaps:
        if gap > 90:
            issues.append(f"Large gap detected: {gap:.1f}s")

    return {
        "broll_count": len(broll_moments),
        "target_count": target_broll_count,
        "gaps_seconds": gaps,
        "avg_gap_seconds": round(avg_gap, 2),
        "variance_seconds": round(variance, 2),
        "target_spacing": round(duration_seconds / target_broll_count, 2),
        "coverage": {
            "start": len([o for o in broll_moments if o.start < duration_seconds * 0.3]) > 0,
            "middle": len(
                [
                    o
                    for o in broll_moments
                    if duration_seconds * 0.3 <= o.start <= duration_seconds * 0.7
                ]
            )
            > 0,
            "end": len([o for o in broll_moments if o.start > duration_seconds * 0.7]) > 0,
        },
        "distribution_healthy": len(issues) == 0,
        "issues": issues,
    }
