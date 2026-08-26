"""
The agent's system prompt, assembled from the skills in skills/.

One skill per capability - what it knows about courses, about the user's notes,
about handing over files - each a folder holding a SKILL.md: YAML style
frontmatter naming and describing it, then the instructions themselves in
Markdown. That is the shape Anthropic's Agent Skills use, and it is borrowed
here on purpose: a skill becomes a file somebody can read and edit on its own,
rather than another few hundred lines inside a Python string, and the agent
grows by gaining a folder instead of by that string getting longer.

Borrowed, not used: this is NOT the Agent Skills API (/v1/skills with
container.skills). That runs a skill inside Anthropic's code execution sandbox,
and everything this agent can actually do lives out here - Canvas over the
user's own token, notes over the backend's API, all of it through MCP tools on
this machine. A skill running in that sandbox could not reach any of it. So the
format is the part worth having, and the loading is local.

What surrounds the skills stays here rather than becoming a fourth folder: who
the agent is, what day it is, and the one rule that governs every answer
regardless of which capability produced it.
"""

from datetime import date
from pathlib import Path
from typing import NamedTuple

SKILLS_DIR = Path(__file__).parent / "skills"

# Who is speaking and how much. First, so everything after it is read in that
# light.
HEADER = "You answer questions about my Canvas coursework. Be brief."

# Last, because it applies to whatever the skills above just produced, and the
# end of a prompt is where an instruction carries furthest.
FOOTER ="""
ANSWERING
Never state a number, filename, date or grade the tools did not return. If a
tool comes back empty, report that rather than filling the gap. Be brief.
"""


class Skill(NamedTuple):
    """One SKILL.md, split into what it says about itself and what it teaches.

    `description` is not sent to the model today - every skill is loaded, so
    nothing has to choose between them. It earns its place by documenting the
    file, and by being what a loader would match on the day this grows enough
    skills that sending all of them stops being sensible.
    """
    name: str
    description: str
    body: str


def _read_skill(path: Path) -> Skill:
    """Parse one SKILL.md.

    The frontmatter is one `key: value` per line between two `---` fences,
    which is all this format needs; no YAML parser is pulled in for it. A file
    that does not look like that raises rather than being skipped, because a
    skill silently missing from the prompt is a behaviour change nobody would
    connect to the file they just edited.
    """
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    #1-)Frontmatter has to open on the first line
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"{path} does not start with a --- frontmatter block")

    #2-)...and close again somewhere below it
    try:
        end = lines.index("---", 1)
    except ValueError:
        raise ValueError(f"{path} has an unclosed --- frontmatter block") from None

    #3-)Everything between the fences describes the skill
    meta = {}
    for line in lines[1:end]:
        if not line.strip():
            continue
        key, separator, value = line.partition(":")
        if not separator:
            raise ValueError(f"{path}: frontmatter line is not 'key: value': {line!r}")
        meta[key.strip()] = value.strip()

    #4-)Both fields are required, the same two Agent Skills requires
    for required in ("name", "description"):
        if not meta.get(required):
            raise ValueError(f"{path} is missing a '{required}' in its frontmatter")

    #5-)Everything below the closing fence is the skill itself
    return Skill(
        name=meta["name"],
        description=meta["description"],
        body="\n".join(lines[end + 1:]).strip(),
    )


def load_skills() -> list[Skill]:
    """Every skill in skills/, in a fixed order.

    Sorted by folder name rather than taken in whatever order the filesystem
    hands them over, so the prompt is byte for byte the same on every machine
    and every run - which is what makes it worth caching, and what stops a
    reordering nobody made from looking like a change somebody did.

    A missing skills/ raises out of iterdir on its own, naming the path it
    looked in, so there is no check for it here. An empty one is the case worth
    catching: it fails quietly instead, leaving an agent with no instructions
    that still answers, badly.
    """
    skills = [
        _read_skill(folder / "SKILL.md")
        for folder in sorted(SKILLS_DIR.iterdir())
        if (folder / "SKILL.md").is_file()
    ]
    if not skills:
        raise RuntimeError(f"No SKILL.md files under {SKILLS_DIR}")
    return skills


def build_prompt() -> str:
    """Header, today's date, every skill, then the rule that outranks them."""
    skills = load_skills()
    return "\n\n".join(
        [
            HEADER,
            f"Today is {date.today():%Y-%m-%d}.",
            *(skill.body for skill in skills),
            FOOTER,
        ]
    )


if __name__ == "__main__":
    # Reading the assembled prompt is the fastest way to check an edit landed
    # the way it looked like it would:  python prompt.py
    for skill in load_skills():
        print(f"# {skill.name}: {skill.description}")
    print("\n" + "-" * 70 + "\n")
    print(build_prompt())
