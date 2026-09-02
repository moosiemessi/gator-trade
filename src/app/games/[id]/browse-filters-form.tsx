"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Section = { code: string; tier: number; level: string };

export function BrowseFiltersForm({ sections }: { sections: Section[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mySection, setMySection] = useState(
    searchParams.get("mySection") ?? "",
  );
  const [minTier, setMinTier] = useState(searchParams.get("minTier") ?? "");
  const [maxTier, setMaxTier] = useState(searchParams.get("maxTier") ?? "");
  const [minQuantity, setMinQuantity] = useState(
    searchParams.get("minQuantity") ?? "",
  );
  const [seatsTogether, setSeatsTogether] = useState(
    searchParams.get("seatsTogether") === "1",
  );
  const [cashDirection, setCashDirection] = useState(
    searchParams.get("cashDirection") ?? "any",
  );
  const [cashOnly, setCashOnly] = useState(
    searchParams.get("cashOnly") === "1",
  );

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (mySection) params.set("mySection", mySection);
    if (minTier) params.set("minTier", minTier);
    if (maxTier) params.set("maxTier", maxTier);
    if (minQuantity) params.set("minQuantity", minQuantity);
    if (seatsTogether) params.set("seatsTogether", "1");
    if (cashDirection !== "any") params.set("cashDirection", cashDirection);
    if (cashOnly) params.set("cashOnly", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setMySection("");
    setMinTier("");
    setMaxTier("");
    setMinQuantity("");
    setSeatsTogether(false);
    setCashDirection("any");
    setCashOnly(false);
    router.push(pathname);
  }

  return (
    <form
      onSubmit={apply}
      className="space-y-4 rounded-md border border-gray-200 p-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700">
          My section
        </label>
        <p className="mb-1 text-xs text-gray-500">
          Sets the upgrade finder: posts offering a better tier than this,
          cheapest for you first.
        </p>
        <select
          value={mySection}
          onChange={(e) => setMySection(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
        >
          <option value="">Not set</option>
          {sections.map((section) => (
            <option key={section.code} value={section.code}>
              Section {section.code} (tier {section.tier}, {section.level})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">
            Min tier
          </label>
          <select
            value={minTier}
            onChange={(e) => setMinTier(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            Max tier
          </label>
          <select
            value={maxTier}
            onChange={(e) => setMaxTier(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            Min quantity
          </label>
          <input
            type="number"
            min={1}
            max={8}
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={seatsTogether}
            onChange={(e) => setSeatsTogether(e.target.checked)}
          />
          Seats together
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={cashOnly}
            onChange={(e) => setCashOnly(e.target.checked)}
          />
          Cash-only sales
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Cash direction</label>
          <select
            value={cashDirection}
            onChange={(e) => setCashDirection(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="any">Any</option>
            <option value="you_pay">I pay</option>
            <option value="they_pay">They pay</option>
            <option value="even">Even swap</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm text-gray-600 underline"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
