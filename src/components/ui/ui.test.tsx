import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, statusLabel } from "./StatusBadge";
import { EvidenceMeter } from "./EvidenceMeter";
import { StatusTimeline, type TimelineEvent } from "./StatusTimeline";

describe("statusLabel", () => {
  it("maps every canonical status in both languages", () => {
    expect(statusLabel("new")).toBe("Submitted");
    expect(statusLabel("in_progress", "hi")).toBe("प्रगति में");
    expect(statusLabel("resolved")).toBe("Resolved");
    expect(statusLabel("rejected", "hi")).toBe("स्वीकृत नहीं");
  });

  it("passes unknown statuses through instead of crashing", () => {
    expect(statusLabel("weird_future_status")).toBe("weird_future_status");
  });
});

describe("StatusBadge", () => {
  it("renders the localized label", () => {
    render(<StatusBadge status="resolved" locale="hi" />);
    expect(screen.getByText("हल हुई")).toBeInTheDocument();
  });
});

describe("EvidenceMeter", () => {
  it("renders an accessible meter clamped to 0-100", () => {
    render(<EvidenceMeter score={140} level="Strong" />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("renders nothing when the backend sent no score", () => {
    const { container } = render(<EvidenceMeter score={null} level={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StatusTimeline", () => {
  const events: TimelineEvent[] = [
    { label: "Submitted", at: "2026-07-01T10:00:00Z", state: "done" },
    { label: "In progress", at: "2026-07-03T09:00:00Z", state: "current" },
    { label: "Resolved", state: "pending" },
  ];

  it("renders every event label in order", () => {
    render(<StatusTimeline events={events} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Submitted");
    expect(items[2]).toHaveTextContent("Resolved");
  });

  it("renders nothing for an empty event list", () => {
    const { container } = render(<StatusTimeline events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
