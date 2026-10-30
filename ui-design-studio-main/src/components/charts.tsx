import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { INRshort } from "@/lib/format";

function ChartFrame({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-64 animate-pulse rounded-md bg-muted/50" aria-hidden />;
  }
  return <div className="h-64 w-full">{children}</div>;
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 12,
  background: "var(--card)",
  color: "var(--foreground)",
};

export function PortfolioBarChart({
  data,
}: {
  data: { region: string; value: number; count: number }[];
}) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="region" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="var(--muted-foreground)"
            tickFormatter={(value: number) => INRshort(value)}
            width={70}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [INRshort(value), "Held"]}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Held" />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function MaturityBarChart({
  data,
}: {
  data: { bucket: string; count: number; value: number }[];
}) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value} instrument${value === 1 ? "" : "s"}`, "Count"]}
          />
          <Bar dataKey="count" fill="var(--chart-3)" radius={[4, 4, 0, 0]} name="Instruments" />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

export function StatusDonut({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--card)"
          >
            {data.map((entry, index) => (
              <Cell key={entry.status} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              `${value} case${value === 1 ? "" : "s"}`,
              name.replace(/_/g, " "),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function LegendList({ data }: { data: { label: string; value: string | number }[] }) {
  return (
    <ul className="space-y-2 text-xs">
      {data.map((entry) => (
        <li key={entry.label} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{entry.label}</span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}
