# Zealex Floating Assistant

## Build
- Add one shared floating assistant in the root layout so its in-memory conversation persists between public and dashboard navigation.
- Create a responsive gold launcher and compact chat panel with starter prompts, accessible message bubbles, streaming/typing feedback, auto-scroll, and a capped input.
- Add a streaming server route using Lovable AI Gateway. Send only the current chat text and a fixed confirmed-facts prompt; never fetch or include account/profile data.
- Validate requests at 500 characters, cap answers, and enforce a best-effort 10-requests-per-minute IP limit in server memory. Return friendly errors for service failures.

## Technical details
- Use the existing AI SDK and gateway secret, keep provider setup server-side, and forward gateway correlation headers.
- Keep transcript state only in the mounted browser widget; do not add conversation storage or database changes.
- Validate with project type/build checks and a browser interaction on the public page; verify the shared widget is mounted at the root for dashboard routes too.
