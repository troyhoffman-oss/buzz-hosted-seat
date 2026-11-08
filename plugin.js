// Hosted seats: a Buzz agent type whose provider is a server you run. The provider holds each
// agent's key and runs the agent; this plugin only passes the app's setup steps to it and shows
// what it reports. The provider's address is written into this file and into manifest.json's
// host.networkOrigins when your copy is built; this source names none.
export const inject = ["react", "agents", "host"];

/** Replaced, exactly once, with the provider's HTTPS origin when a copy is built. */
const PROVIDER = "https://provider.invalid";

async function call(host, path, method, body, signal) {
  signal?.throwIfAborted();
  let response;
  try {
    response = await host.request({
      url: `${PROVIDER}${path}`,
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    signal?.throwIfAborted();
    throw new Error(`The seat provider is not reachable: ${error?.message ?? error}`);
  }
  signal?.throwIfAborted();
  let result = {};
  try {
    result = response.body ? JSON.parse(response.body) : {};
  } catch {
    // A non-JSON answer is reported by its status below.
  }
  if (response.status < 200 || response.status > 299)
    throw new Error(result.error ?? `The seat provider answered ${response.status}`);
  return result;
}

export function apply(ctx) {
  const React = ctx.react;
  const h = React.createElement;
  const host = ctx.host;

  /** Hook: a provider answer for `path`, with its error. */
  function useProvider(path) {
    const [state, setState] = React.useState({ loading: true });
    React.useEffect(() => {
      const controller = new AbortController();
      call(host, path, "GET", undefined, controller.signal).then(
        (data) => setState({ data }),
        (error) => controller.signal.aborted || setState({ error: error.message }),
      );
      return () => controller.abort();
    }, [path]);
    return state;
  }

  /** The New agent dialog: which of the provider's seats this agent is. The seats are a choice
   * list in the host's own form classes (Buzz's Radio markup), so they take the dialog's colors;
   * a native select draws its popup in the system's colors instead. */
  function Create({ config, onChange, disabled }) {
    const label = React.useId();
    const { data, error, loading } = useProvider("/seats");
    if (loading) return h("p", null, "Asking the seat provider…");
    if (error) return h("p", { role: "alert" }, error);
    const open = data.seats.filter((seat) => !seat.active);
    if (open.length === 0) return h("p", null, "Every seat this provider hosts is already set up.");
    const chosen = open.findIndex((seat) => seat.id === config.seat);
    const choose = (index, focus) => {
      onChange({ ...config, seat: open[index].id });
      if (focus) document.getElementById(`${label}-${index}`)?.focus();
    };
    // A radio group: one tab stop, arrows move and choose (as Buzz's Radio does).
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    return h(
      "div",
      { className: "buzz-field" },
      h("span", { id: label, className: "buzz-field-label" }, "Seat"),
      h(
        "div",
        { role: "radiogroup", "aria-labelledby": label, className: "buzz-radio-group", "data-size": "md" },
        ...open.map((seat, index) => {
          const checked = index === chosen;
          const id = `${label}-${index}`;
          return h(
            "label",
            { key: seat.id, htmlFor: id, className: "buzz-choice", "data-variant": "card", "data-size": "md" },
            h(
              "button",
              {
                id,
                type: "button",
                role: "radio",
                "aria-checked": checked,
                "aria-labelledby": `${id}-label`,
                "aria-describedby": `${id}-description`,
                className: "buzz-radio",
                "data-variant": "card",
                "data-size": "md",
                "data-checked": checked ? "" : undefined,
                "data-disabled": disabled ? "" : undefined,
                disabled,
                tabIndex: checked || (chosen < 0 && index === 0) ? 0 : -1,
                onClick: () => choose(index, false),
                onKeyDown: (event) => {
                  if (!step[event.key]) return;
                  event.preventDefault();
                  choose((index + step[event.key] + open.length) % open.length, true);
                },
              },
              checked ? h("span", { className: "buzz-radio-indicator" }) : null,
            ),
            h(
              "span",
              null,
              h("span", { id: `${id}-label`, className: "buzz-choice-label" }, seat.name),
              h("span", { id: `${id}-description`, className: "buzz-choice-description" }, seat.id),
            ),
          );
        }),
      ),
    );
  }

  /** What the provider reports for this agent. */
  function Status({ agent }) {
    const { data, error, loading } = useProvider(`/agents/${encodeURIComponent(agent.pubkey)}`);
    if (loading) return h("p", null, "Asking the seat provider…");
    if (error) return h("p", { role: "alert" }, error);
    return h(
      "p",
      null,
      data.active
        ? `Seat ${data.seat}, running on its provider.`
        : `Seat ${data.seat}: made, setup not finished.`,
    );
  }

  ctx.agents.register({
    id: "seat",
    title: "Hosted seat",
    description: "An agent seat your own provider runs. The provider holds its key.",
    defaults: () => ({ config: { seat: "" } }),
    summary: () => "Hosted by its provider",
    Create,
    tabs: [{ id: "status", title: "Status", component: Status }],
    remote: {
      provision: ({ name, picture, community, config, signal }) => {
        if (!config?.seat) throw new Error("Choose a seat first.");
        return call(host, "/agents", "POST", { seat: config.seat, name, picture, community }, signal);
      },
      activate: async ({ pubkey, name, community, auth, signal }) => {
        await call(host, `/agents/${encodeURIComponent(pubkey)}/activate`, "POST", { name, community, auth }, signal);
      },
      profile: async ({ pubkey, community, name, picture, signal }) => {
        await call(host, `/agents/${encodeURIComponent(pubkey)}/profile`, "POST", { community, name, picture }, signal);
      },
      remove: async () => {
        throw new Error("A hosted seat is retired on its provider, not from Buzz.");
      },
    },
  });
}
