---
name: canvas-coursework
description: Everything that comes out of Canvas - working out which course and which term a question is about before calling any tool that takes a course id, which tools answer the questions people actually ask, and handing the resulting files over to someone reading the reply in a browser. Use whenever a question names a class, a course, a subject, a semester, or asks what a course covers, what is due, how grades stand, or for slides, readings and anything downloadable.
---

# Canvas coursework

## Naming a course

Every course carries two names, and they are not what the field names suggest:

    name  = the section code, e.g. "2026S CS 334-A"
    title = the readable one,  e.g. "Theory of Computation"

People almost always say the title, or a fragment of either ("334", "CS334",
"theory of comp", "linear algebra"). So:

1. Call list_courses or get_grades first and match against BOTH fields,
   case-insensitively, on substrings - never on an exact string.
2. Never invent or guess a course id. Every id must come from a tool result.
3. If several courses match, ask which one, listing title, code and term.
4. If none match, say so and show the courses you did find for that term.
   Do not conclude the course does not exist - it may be in another term.

## Terms

Terms are named like "2026 Spring Semester". Pass one to get_grades or
list_courses when the question names a semester. "This semester" means the most
recent term that actually has grades: a term that has just started has none yet,
so falling back to the newest graded term is correct, and say which you used.
A course from years ago is still available - search all terms before giving up.

## Files and downloads

The person asking is reading your reply in a chat panel in their browser, and
that panel renders Markdown. So hand files over as links they can click:

    - [L1.Automata.pdf](<the file's url>) (1183 KB)

Use the `url` each file tool already returns. It is pre-signed and expires, so
give it out when you find it rather than describing the file and waiting.

download_files is the other thing entirely: it writes to ~/Downloads on the
machine running this agent, which is not necessarily theirs. Reach for it only
when someone asks for files saved to disk, and say where they landed. When they
just want the file, a link is the answer.

## Common questions, and how to work them

Resolve the course first in every one of these - "Naming a course" above - then:

**"What is this course about?" / "what do we cover?"**
get_modules. The module names in teaching order ARE the syllabus: read the arc
off them and say it. Then go looking for the document that states it properly -
scan the module items, and run get_page_files with a substring like "syllabus",
"overview" or "introduction" - and hand over the two or three whose names
promise the most. Say why you picked those.

**"What is on the exam?" / "what should I study for X?"**
get_modules for the material either side of the exam item, get_assignments for
what it is worth and when it falls. The modules between the last exam and this
one are the scope.

**"Where is X?" / "do we have slides on Y?"**
get_modules is the spine. But a lecture is a Page with file=None there, so its
slides need get_page_files - on get_modules alone the lectures look empty.
Solution keys are the reverse: they sit in modules as File items and are not on
the assignment, so get_assignment_files will not find them.

**"What is due?" / "what am I behind on?"**
get_assignments for the shape of the workload, bucketed by time.
get_unsubmitted for what is actually outstanding in one course.

**"How am I doing?"**
get_grades across courses, get_assignment_grades inside one. An assignment's
`group` is the weighted category it counts toward, which is what explains why
one mark moved the total and another did not.

### Choosing between files

Several files can plausibly hold an answer, and the names are all you have to
go on. Take the two or three that promise the most and say what you took -
"the syllabus and the week 1 slides look like the ones that answer this" -
rather than listing everything the course has or picking one at random. If they
want something else, they will say so, and that costs one message.

### What you can and cannot see

You get names and structure - module names, page titles, file names, sizes -
never the text inside a PDF or a page. So describe what a document is from its
name and hand over the link; never state what it says. "The syllabus is here"
is right. "The syllabus says the midterm is 30%" is invented, unless a tool
actually returned that number.
