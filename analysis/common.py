"""Shared helpers for the opening analysis."""
import math

DRAW = {"agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"}


def points(res):
    return 1 if res == "win" else (0.5 if res in DRAW else 0)


def win_chance(cp):
    """Lichess's winning-chances formula, -1..1 from the side whose score it is."""
    cp = max(-1500, min(1500, cp))
    return 2 / (1 + math.exp(-0.00368208 * cp)) - 1


def key(fen):
    return " ".join(fen.split()[:4])


def is_kid(r):
    """Black games against anything but 1.e4 where ...Nf6, ...g6 and ...Bg7 come in the first 8 moves."""
    if r["color"] != "b" or not r["sans"] or r["sans"][0] == "e4":
        return False
    bl = r["sans"][1::2][:8]
    return "g6" in bl and "Bg7" in bl and "Nf6" in bl


def classify(s):
    """White's system from its first moves (SAN list of the whole game)."""
    w = s[0::2][:8]
    has = lambda m, n=6: m in w[:n]
    if s[0] in ("c4", "Nf3", "g3", "b3", "e3", "f4", "Nc3", "b4") and "d4" not in w[:3]:
        if s[0] == "b3": return "Nimzo-Larsen (1.b3)"
        if s[0] == "c4": return "English (1.c4)"
        if s[0] == "Nf3" and not has("d4", 4): return "Reti / KIA (1.Nf3)"
        if s[0] == "e3": return "1.e3 systems"
    if has("c4", 5) and has("e4", 6) and has("Nc3", 6):
        if has("f3", 7): return "KID main: Samisch (f3)"
        if has("f4", 7): return "KID main: Four Pawns (f4)"
        if has("Bg5", 7) and not has("Nf3", 7): return "KID main: Averbakh (Be2+Bg5)"
        if has("Nf3", 7): return "KID main: Classical (Nf3)"
        return "KID main: other c4+e4"
    if has("c4", 5) and has("g3", 6): return "KID: Fianchetto (c4+g3)"
    if has("c4", 4): return "KID: c4 without e4"
    if len(s) > 2 and s[2] == "Bg5": return "Trompowsky (2.Bg5)"
    if has("Bf4", 3) and has("Nc3", 4): return "Jobava / Barry (Nc3+Bf4)"
    if has("Bf4", 4): return "London (Bf4)"
    if has("Bg5", 5) and has("Nf3", 4): return "Torre (Nf3+Bg5)"
    if has("e4", 5) and has("Nc3", 5): return "e4+Nc3 (Pirc/150 style)"
    if has("e3", 4) and not has("Bf4", 6): return "Colle / e3 systems"
    if has("g3", 5): return "Fianchetto without c4"
    if has("b3", 5): return "Nimzo-Larsen (1.b3)"
    return "Other"


# Chapter of the site's course that covers each system.
CHAPTER = {
    "London (Bf4)": "london", "Colle / e3 systems": "colle", "1.e3 systems": "flank",
    "Jobava / Barry (Nc3+Bf4)": "jobava", "e4+Nc3 (Pirc/150 style)": "jobava",
    "KID: c4 without e4": "c4quiet", "KID: Fianchetto (c4+g3)": "c4quiet",
    "Trompowsky (2.Bg5)": "bg5", "Torre (Nf3+Bg5)": "bg5",
    "Reti / KIA (1.Nf3)": "flank", "English (1.c4)": "flank", "Nimzo-Larsen (1.b3)": "flank", "Fianchetto without c4": "flank",
}
