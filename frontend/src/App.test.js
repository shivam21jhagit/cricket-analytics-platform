import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import App from "./App";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn()
  }
}));

let prefersLight = false;
let mediaQueryListeners = [];

function setSystemThemePreference(matches) {
  prefersLight = matches;
  mediaQueryListeners.forEach((listener) =>
    listener({ matches, media: "(prefers-color-scheme: light)" })
  );
}

beforeEach(() => {
  prefersLight = false;
  mediaQueryListeners = [];

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      get matches() {
        return prefersLight;
      },
      media: query,
      onchange: null,
      addListener: (listener) => mediaQueryListeners.push(listener),
      removeListener: (listener) => {
        mediaQueryListeners = mediaQueryListeners.filter((item) => item !== listener);
      },
      addEventListener: (eventName, listener) => {
        if (eventName === "change") {
          mediaQueryListeners.push(listener);
        }
      },
      removeEventListener: (eventName, listener) => {
        if (eventName === "change") {
          mediaQueryListeners = mediaQueryListeners.filter((item) => item !== listener);
        }
      },
      dispatchEvent: jest.fn()
    }))
  });

  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  axios.get.mockResolvedValue({ data: { batters: [], bowlers: [] } });
  axios.post.mockResolvedValue({ data: {} });
  global.fetch = jest.fn(() => new Promise(() => {}));
});

afterEach(() => {
  jest.useRealTimers();
});

test("renders the home tab shell", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { level: 1, name: /CricketAI Platform/i })
  ).toBeInTheDocument();
  expect(screen.getAllByText(/CricketAI/i).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /^Open Prediction$/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Switch to Home tab/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Open Prediction tab/i })).toBeInTheDocument();
});

test("supports light, dark, and system theme modes", async () => {
  render(<App />);

  await waitFor(() =>
    expect(document.documentElement).toHaveAttribute("data-theme", "dark")
  );
  expect(document.documentElement).toHaveAttribute("data-theme-preference", "dark");
  expect(screen.getByRole("button", { name: /^Dark$/i })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: /^Light$/i }));

  await waitFor(() =>
    expect(document.documentElement).toHaveAttribute("data-theme", "light")
  );
  expect(window.localStorage.getItem("cap-theme")).toBe("light");

  fireEvent.click(screen.getByRole("button", { name: /^Dark$/i }));

  await waitFor(() =>
    expect(document.documentElement).toHaveAttribute("data-theme", "dark")
  );
  expect(window.localStorage.getItem("cap-theme")).toBe("dark");

  fireEvent.click(screen.getByRole("button", { name: /^System$/i }));

  await waitFor(() =>
    expect(document.documentElement).toHaveAttribute("data-theme-preference", "system")
  );
  expect(window.localStorage.getItem("cap-theme")).toBe("system");

  act(() => {
    setSystemThemePreference(true);
  });

  await waitFor(() =>
    expect(document.documentElement).toHaveAttribute("data-theme", "light")
  );
});

test("renders dashboard workspace shortcuts", () => {
  render(<App />);

  expect(screen.getAllByText(/Live Intelligence/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Scale Target/i)).toBeInTheDocument();
  expect(screen.getAllByText(/MI vs RCB/i).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /Open Simulation tab/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Open Analytics tab/i })).toBeInTheDocument();
});

test("opens live match links in a new browser tab", () => {
  render(<App />);

  const currentMatchLinks = screen.getAllByRole("link", {
    name: /Open MI vs RCB live score in a new tab/i
  });
  expect(currentMatchLinks.length).toBeGreaterThan(0);
  currentMatchLinks.forEach((link) => {
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("href", expect.stringContaining("MI%20vs%20RCB"));
  });

  expect(
    screen.getByRole("link", { name: /Open CSK vs RR live score in a new tab/i })
  ).toHaveAttribute("target", "_blank");
  expect(
    screen.getByRole("link", { name: /Open IND vs AUS live score in a new tab/i })
  ).toHaveAttribute("target", "_blank");
});

test("opens the prediction tab from home", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^Open Prediction$/i }));

  expect(await screen.findByRole("button", { name: /Back Home/i })).toBeInTheDocument();
  expect(await screen.findByText(/Choose the batter and bowler/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Switch to Prediction tab/i })).toHaveClass(
    "nav-tab--active"
  );
  expect(screen.getByDisplayValue(/Virat Kohli/i)).toBeInTheDocument();
  expect(screen.getByDisplayValue(/Jasprit Bumrah/i)).toBeInTheDocument();
  expect(screen.queryByText(/Current Score/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Recent Commentary/i)).not.toBeInTheDocument();
});

test("switches to the fantasy tab from home", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^Open Fantasy$/i }));

  await screen.findByText(/Catalog/i);
  expect(screen.getByRole("button", { name: /Switch to Fantasy tab/i })).toHaveClass(
    "nav-tab--active"
  );
});
