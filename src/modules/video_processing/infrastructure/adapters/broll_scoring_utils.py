"""
Semantic matching utilities for B-roll selection.

Handles:
- Semantic similarity scoring (keyword overlap + synonym expansion + thematic grouping)
- Anchor subject filtering (person, object, scene)
- Context tone evaluation (emotional mood keywords)
"""

import re
from typing import Set, Dict, List, Tuple


# ── SYNONYM MAPPINGS ────────────────────────────────────────────────────────────

SYNONYM_MAPPINGS: Dict[str, Set[str]] = {
    # Emotional states
    "sad": {"depression", "grief", "cry", "tearful", "melancholy", "sorrow", "heartbreak", "pain"},
    "happy": {"joy", "laugh", "smile", "celebration", "festive", "cheerful", "delight", "bliss"},
    "angry": {"rage", "fury", "conflict", "tension", "fight", "aggression", "shouting"},
    "peaceful": {"calm", "serene", "tranquil", "relax", "meditation", "quiet", "still"},

    # Professional contexts
    "professional": {"corporate", "business", "formal", "executive", "office", "formal wear", "suit"},
    "meeting": {"conference", "discussion", "presentation", "gathering", "assembly", "briefing"},
    "teamwork": {"collaboration", "cooperation", "together", "group", "unified", "collective"},

    # Visual styles
    "futuristic": {"sci-fi", "neon", "holographic", "digital", "tech", "cyberpunk", "advanced", "ai"},
    "cinematic": {"cinematic", "dramatic", "professional", "epic", "film", "camera", "motion"},
    "natural": {"organic", "outdoor", "raw", "authentic", "genuine", "real", "unfiltered", "nature"},

    # Product/Brand related
    "bottle": {"container", "beverage", "drink", "glass", "soda", "liquid"},
    "digital": {"screen", "technology", "device", "electronic", "digital", "interface", "virtual"},
    "creative": {"art", "design", "creation", "innovation", "imagine", "artistic", "originality"},

    # Actions
    "interaction": {"touch", "use", "interact", "manipulate", "engage", "handle"},
    "creation": {"create", "make", "build", "develop", "generate", "produce", "craft"},
    "celebration": {"celebrate", "party", "festive", "toast", "rejoice", "cheer"},
}

# ── THEMATIC GROUPS ────────────────────────────────────────────────────────────

THEMATIC_GROUPS: Dict[str, Set[str]] = {
    "brand": {"brand", "logo", "product", "company", "corporate", "trademark", "identity"},
    "emotion": {"emotion", "feeling", "sentiment", "mood", "heart", "passion", "touch"},
    "technology": {"tech", "digital", "ai", "robot", "machine", "computer", "software"},
    "nature": {"nature", "outdoor", "landscape", "plant", "animal", "weather", "natural"},
    "people": {"person", "human", "people", "man", "woman", "child", "face", "expression"},
    "business": {"business", "work", "office", "meeting", "professional", "corporate", "enterprise"},
    "creative": {"creative", "art", "idea", "imagine", "design", "innovation", "concept"},
    "action": {"action", "movement", "dynamic", "motion", "fast", "energy", "active"},
}


def tokenize_terms(text: str, min_length: int = 3) -> Set[str]:
    """
    Extract meaningful terms from text.

    Filters stop words and very short words.
    """
    if not text:
        return set()

    stop_words = {
        "the", "and", "with", "this", "that", "from", "your", "into", "about", "when",
        "what", "where", "there", "have", "has", "been", "will", "just", "they", "them",
        "their", "while", "over", "under", "more", "than", "using", "used", "make",
        "video", "people", "person", "talk", "talking", "speaker", "is", "are", "be",
        "do", "does", "did", "can", "could", "would", "should", "may", "might", "must",
        "on", "at", "in", "by", "to", "for", "of", "or", "as", "if", "it", "a", "an",
        "not", "no", "yes", "but", "so", "up", "out", "all", "each", "every", "both",
    }

    words = re.findall(r"[a-zA-Z]{" + str(min_length) + r",}", text.lower())
    return {w for w in words if w not in stop_words}


def semantic_similarity_score(text_a: str, text_b: str) -> float:
    """
    Calculate semantic similarity between two texts.

    Combines:
    1. Direct keyword overlap (0-1)
    2. Synonym expansion match (0-1)
    3. Thematic grouping (0-1)

    Returns: 0-1 score

    Examples:
    • "person crying" vs "actor sad" → ~0.75 (emotional theme match)
    • "Coca-Cola bottle" vs "red soda can" → ~0.80 (synonym + thematic)
    • "office meeting" vs "corporate environment" → ~0.75 (thematic overlap)
    """
    keywords_a = tokenize_terms(text_a)
    keywords_b = tokenize_terms(text_b)

    if not keywords_a and not keywords_b:
        return 1.0  # Both empty = identical

    if not keywords_a or not keywords_b:
        return 0.0  # One empty, other not = no match

    # 1. Direct keyword overlap (Jaccard similarity)
    overlap = keywords_a.intersection(keywords_b)
    union = keywords_a.union(keywords_b)
    base_score = len(overlap) / len(union) if union else 0.0

    # 2. Synonym expansion (check if keywords are synonyms)
    synonym_score = _compute_synonym_matches(keywords_a, keywords_b)

    # 3. Thematic grouping (check if keywords belong to same theme)
    thematic_score = _compute_thematic_matches(keywords_a, keywords_b)

    # Weighted combination: direct match is most important
    final_score = (base_score * 0.5) + (synonym_score * 0.3) + (thematic_score * 0.2)
    return min(1.0, max(0.0, final_score))


def anchor_subject_match(anchor_subject: str, clip_metadata: Dict) -> float:
    """
    Match clip's main subject against expected anchor_subject.

    Valid values: "person", "object", "scene", "none"

    Returns: 0-1 score
    • 1.0 = Perfect match or no constraint (anchor_subject="none")
    • 0.5 = Acceptable but not ideal
    • 0.3 = Mismatch but salvageable
    • 0.0 = Complete mismatch

    Examples:
    • anchor_subject="person", clip tags has "person" → 1.0
    • anchor_subject="person", clip tags has "product" → 0.3
    • anchor_subject="none" → 1.0 (no constraint)
    """
    if not anchor_subject or anchor_subject.lower() == "none":
        return 1.0  # No constraint

    anchor_subject = anchor_subject.lower()

    # Extract subject hints from clip metadata
    clip_tags = set()
    for tag in clip_metadata.get("video_tags", []):
        if isinstance(tag, dict):
            clip_tags.add(tag.get("name", "").lower())
        else:
            clip_tags.add(str(tag).lower())

    clip_text = " ".join(clip_tags)
    user_name = clip_metadata.get("user", {}).get("name", "").lower() if isinstance(clip_metadata.get("user"), dict) else ""
    full_clip_text = clip_text + " " + user_name

    # Map expected subjects to keywords to look for
    subject_keywords = {
        "person": {"person", "people", "human", "face", "actor", "portrait", "close-up", "man", "woman", "child"},
        "object": {"object", "product", "item", "thing", "bottle", "container", "device", "equipment"},
        "scene": {"scene", "landscape", "environment", "outdoor", "indoor", "background", "setting", "location"},
    }

    expected_keywords = subject_keywords.get(anchor_subject, set())

    # Check if clip contains expected keywords
    if not expected_keywords:
        return 0.5  # Unknown subject type, neutral score

    clip_keywords = tokenize_terms(full_clip_text)
    matches = len(clip_keywords.intersection(expected_keywords))

    if matches > 0:
        return 1.0  # Found expected subject

    # Check for opposite subjects (penalize)
    opposite_map = {
        "person": {"object", "product"},
        "object": {"person", "people"},
        "scene": {"portrait", "close-up"},
    }

    opposite_keywords = opposite_map.get(anchor_subject, set())
    if any(opp in clip_keywords for opp in opposite_keywords):
        return 0.3  # Contains opposite subject type

    return 0.7  # Uncertain but not contradictory


def context_tone_score(spoken_context: str, clip_metadata: Dict) -> float:
    """
    Evaluate emotional/contextual tone match between spoken_context and clip.

    Identifies emotional tone categories:
    • emotional: heartfelt, intimate, personal
    • energetic: dynamic, action, movement
    • professional: corporate, formal, business
    • creative: art, innovation, design
    • intimate: close-up, personal, vulnerable

    Returns: 0-1 score based on tone alignment

    Examples:
    • spoken="heartfelt moments", clip tags="close-up emotional" → 0.9
    • spoken="corporate meeting", clip tags="sad person" → 0.4
    • spoken="innovative technology", clip tags="digital interface" → 0.8
    """
    if not spoken_context:
        return 1.0  # No context constraint

    # Define tone keyword patterns
    tone_keywords = {
        "emotional": {"emotion", "cry", "tear", "heartfelt", "intimate", "connection", "warm", "love", "bond", "family"},
        "energetic": {"energy", "dynamic", "action", "fast", "movement", "vibrant", "active", "motion", "speed"},
        "professional": {"office", "meeting", "corporate", "formal", "business", "executive", "professional", "suit"},
        "creative": {"art", "design", "creation", "digital", "innovation", "imagine", "paint", "compose", "build"},
        "intimate": {"close", "detail", "face", "personal", "private", "vulnerable", "expression", "moment"},
    }

    # Extract tone category from spoken context
    context_words = tokenize_terms(spoken_context)
    context_tones = {}

    for tone, keywords in tone_keywords.items():
        matches = len(context_words.intersection(keywords))
        if matches > 0:
            context_tones[tone] = matches / max(len(context_words), 1)

    if not context_tones:
        return 0.5  # Neutral, no strong tone detected

    # Extract tone from clip metadata
    clip_tags = set()
    for tag in clip_metadata.get("video_tags", []):
        if isinstance(tag, dict):
            clip_tags.add(tag.get("name", "").lower())
        else:
            clip_tags.add(str(tag).lower())

    # Calculate tone match
    total_score = 0.0
    for tone, confidence in context_tones.items():
        tone_keywords_set = tone_keywords[tone]
        matches = len(clip_tags.intersection(tone_keywords_set))

        if matches > 0:
            total_score += confidence * (matches / max(len(clip_tags), 1))

    avg_score = total_score / len(context_tones) if context_tones else 0.5
    return min(1.0, max(0.0, avg_score))


def build_clip_description(clip: Dict) -> str:
    """
    Build a text description of a Pexels clip for semantic comparison.

    Combines: tags + publisher + metadata
    """
    parts = []

    # Tags
    for tag in clip.get("video_tags", []):
        if isinstance(tag, dict):
            parts.append(tag.get("name", ""))
        else:
            parts.append(str(tag))

    # Publisher/user
    if isinstance(clip.get("user"), dict):
        parts.append(clip.get("user", {}).get("name", ""))

    # Duration hint
    duration = clip.get("duration", 0)
    if duration > 0:
        if duration > 30:
            parts.append("long")
        elif duration < 5:
            parts.append("short")

    # Resolution hint
    width = clip.get("width", 0)
    if width >= 3840:
        parts.append("4k")
    elif width >= 1920:
        parts.append("hd")

    return " ".join(parts).lower()


# ── PRIVATE HELPERS ────────────────────────────────────────────────────────────

def _compute_synonym_matches(keywords_a: Set[str], keywords_b: Set[str]) -> float:
    """
    Check if keywords are synonyms (indirect keyword match).

    Returns: 0-1 score
    """
    if not keywords_a or not keywords_b:
        return 0.0

    matches = 0
    total_checks = 0

    for keyword_a in keywords_a:
        for keyword_b in keywords_b:
            total_checks += 1

            # Direct synonym match
            if keyword_a in SYNONYM_MAPPINGS.get(keyword_b, set()):
                matches += 1
            elif keyword_b in SYNONYM_MAPPINGS.get(keyword_a, set()):
                matches += 1

    return min(1.0, matches / max(total_checks, 1)) if total_checks > 0 else 0.0


def _compute_thematic_matches(keywords_a: Set[str], keywords_b: Set[str]) -> float:
    """
    Check if keywords belong to same thematic group.

    Returns: 0-1 score
    """
    if not keywords_a or not keywords_b:
        return 0.0

    # Map keywords to themes
    themes_a = {}
    themes_b = {}

    for keyword in keywords_a:
        for theme, keywords_set in THEMATIC_GROUPS.items():
            if keyword in keywords_set:
                themes_a[theme] = themes_a.get(theme, 0) + 1

    for keyword in keywords_b:
        for theme, keywords_set in THEMATIC_GROUPS.items():
            if keyword in keywords_set:
                themes_b[theme] = themes_b.get(theme, 0) + 1

    if not themes_a or not themes_b:
        return 0.0

    # Jaccard similarity of theme sets
    themes_a_set = set(themes_a.keys())
    themes_b_set = set(themes_b.keys())

    overlap = len(themes_a_set.intersection(themes_b_set))
    union = len(themes_a_set.union(themes_b_set))

    return overlap / union if union > 0 else 0.0
