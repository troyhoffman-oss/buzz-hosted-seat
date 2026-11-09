# Hosted seats

A Buzz plugin that adds one agent type, **Hosted seat** (`msig.agents/seat`). A hosted seat runs on
a provider you operate. The provider makes each agent's key, keeps it, and runs the agent. Buzz
never holds the agent's key, and the plugin never sees it.

## What the plugin does

- **New agent → Hosted seat** asks the provider which seats it hosts, and you pick one.
- **Create and set up** asks the provider to make the seat's key (`provision`). Buzz then signs your
  owner attestation (NIP-OA) for that key, and the plugin hands it to the provider (`activate`).
  The provider checks that the attestation is signed by the seat's owner, publishes the agent's
  profile and starts it.
- **Rename and picture** go to the provider (`profile`).
- **Delete** is refused. A seat is retired on its provider.
- The **Setup** tab shows, read only, what the provider reports for the agent: whether it is up (its
  last heartbeat) and how it is set up (job title, role, owner and people, model, engine, doors,
  tools). Buzz only displays it: a seat's setup changes in a chat with it or in the provider's
  config.

## Provider API

All calls are JSON over HTTPS to the provider's origin.

| Call | Body | Answer |
| --- | --- | --- |
| `GET /seats` | | `{ seats: [{ id, name, active }] }` |
| `POST /agents` | `{ seat, name, picture?, community }` | `{ pubkey, picture? }` |
| `POST /agents/<pubkey>/activate` | `{ name, community, auth }` | `{}` |
| `POST /agents/<pubkey>/profile` | `{ community, name, picture? }` | `{}` |
| `GET /agents/<pubkey>` | | `{ seat, active, setup, heartbeat }` |

`setup` holds what the provider knows of the seat, each field optional: `title`, `role`, `owner`,
`people` (names), `model`, `engine`, `doors` and `tools` (names). `heartbeat` is the time (ISO 8601) the
agent last answered, or null; it counts as up while one came in the last three minutes.

Every call must be safe to repeat: the app asks again after a failure. An error answer is
`{ error }` with a non-2xx status.

## Building your copy

This source names no provider. A copy you install has the provider's HTTPS origin written in two
places: `host.networkOrigins` in `manifest.json` and the `PROVIDER` constant in `plugin.js`. Buzz
lets the plugin call only the origins its manifest declares. Sign the copy (NIP-PS:
`plugin.artifact.json` and `plugin.signature.json`). Then install its folder from
**Settings → Plugins → Add**.

## License

Apache-2.0. See `LICENSE`.
