# GPT-Live-1 notes

Working notes for the GPT-Live-1 voice engine on 1 good choice
(`docs/handoffs/30-onegoodchoice-gpt-live-1.md`). Checked 2026-09-14.

## Access

- `GET https://api.openai.com/v1/models/gpt-live-1` with the key in `.env.local` returned
  **200** (`"id": "gpt-live-1"`, `"shutdown_date": null`).
- The org's usage tier was not read. It sets the concurrent-session ceiling: 25 at Tier 1, up to
  500 at Tier 5.

## Request shape, confirmed against the API

`POST https://api.openai.com/v1/live/sessions`, JSON, API key on the server. Probed with two
incomplete bodies, which OpenAI refused without starting a session:

| Body | Answer |
| --- | --- |
| `{}` | 400 `Only the webrtc transport is supported.` (`param: transport.type`) |
| `{ session: {...}, transport: { type: "webrtc" } }` | 400 `An SDP offer is required.` (`param: transport.sdp`) |

`/v1/live` is a different method that only takes `application/sdp`. The app uses
`/v1/live/sessions`.

What the session route sends, and nothing else, because the config rejects unknown fields:

```json
{
  "session": {
    "model": "gpt-live-1",
    "instructions": "…",
    "audio": { "output": { "voice": "marin" } },
    "delegation": { "type": "client" }
  },
  "transport": { "type": "webrtc", "sdp": "v=0…" }
}
```

The answer is `{ "session": { "id": "live_…" }, "transport": { "type": "webrtc", "sdp": "…" } }`.
The browser sets that SDP as the remote answer, opens data channel `oai-events`, and waits for
`session.started`. It never sends `session.start`. The safety identifier goes as the
`OpenAI-Safety-Identifier` header, as on the Realtime mint.

## Events the app uses

Server to app:

- `session.started`
- `session.input_transcript.delta` and `session.output_transcript.delta`: `delta`, `start_ms`,
  `end_ms` on the session timeline. No turn-completed event.
- `session.delegation.created`: `{ delegation: { id, type: "delegation", target: "client" } }`,
  with no task text.
- `session.closed`: `reason` (`close_requested`, `expired`, `content`, `remote_hangup`,
  `connection_lost`) and `usage: { seconds }`.
- `error`: `{ error: { type, code, message, param, client_event_id } }`.

App to server, each with an `event_id`:

- `session.thinking.append` (quiet context) and `session.commentary.append` (say this aloud; it
  may paraphrase): `delegation_id` (`null` for general context) and `content` up to 500 tokens.
  The app caps content at 1,500 characters.
- `session.instructions.append`, which interrupts speech in progress.
- `session.close`, then wait for `session.closed`.

GPT-Live has no `response.create`, `response.cancel`, `output_audio_buffer.clear`,
`conversation.item.truncate`, `turn_detection`, `create_response` or `interrupt_response`.

## Billing and data

- $0.05 per connected minute, billed per second, silence and backend waiting included. Muting
  the mic does not stop the meter; `session.close` does.
- `/v1/live/sessions` keeps abuse-monitoring data 30 days and is ZDR-eligible with limitations.
  No `store`, so no recording is kept. HIPAA eligibility for this endpoint is unverified.

## Sources

- https://developers.openai.com/api/docs/models/gpt-live-1
- https://developers.openai.com/api/docs/guides/voice-webrtc (GPT-Live variant)
- https://developers.openai.com/api/docs/guides/live-migration
- https://developers.openai.com/api/docs/guides/live-delegation
- https://developers.openai.com/api/docs/guides/live-conversations
- https://developers.openai.com/api/docs/guides/voice-server-controls
- https://developers.openai.com/api/docs/guides/voice-latency-cost
- https://developers.openai.com/api/docs/guides/your-data
- https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/gpt-live
