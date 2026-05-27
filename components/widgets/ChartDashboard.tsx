'use client';

import { DashboardParams } from '@/types/widget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function ChartDashboard({ params }: { params: DashboardParams }) {
  const { kpis, chart, table } = params;

  const renderTrendIcon = (trend: string) => {
    switch(trend) {
      case 'up': return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'down': return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderChart = () => {
    if (!chart.data || chart.data.length === 0) return null;
    
    // Determine keys for X and Y axis based on the first data point
    const dataKeys = Object.keys(chart.data[0]);
    // Assume first key is X axis (often 'name', 'date', or 'month'), the rest are data series
    const xAxisKey = dataKeys[0];
    const seriesKeys = dataKeys.slice(1);

    const colors = ['#8884d8', '#82ca9d', '#ffc658'];

    const commonProps = {
      data: chart.data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 }
    };

    if (chart.type === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis dataKey={xAxisKey} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
          />
          {seriesKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
    }

    if (chart.type === 'area') {
      return (
        <AreaChart {...commonProps}>
          <defs>
            {seriesKeys.map((key, i) => (
              <linearGradient key={`color${key}`} id={`color${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis dataKey={xAxisKey} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
          />
          {seriesKeys.map((key, i) => (
            <Area 
              key={key} 
              type="monotone" 
              dataKey={key} 
              stroke={colors[i % colors.length]} 
              fillOpacity={1} 
              fill={`url(#color${key})`} 
            />
          ))}
        </AreaChart>
      );
    }

    // Default to Line
    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
        <XAxis dataKey={xAxisKey} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
        />
        {seriesKeys.map((key, i) => (
          <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        ))}
      </LineChart>
    );
  };

  return (
    <div className="flex flex-col space-y-6 w-full h-full p-2">
      {/* KPIs Grid */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {kpis.map((kpi, idx) => (
            <Card key={idx} className="bg-muted/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                {renderTrendIcon(kpi.trend)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className={`text-xs mt-1 ${
                  kpi.trend === 'up' ? 'text-green-500' : 
                  kpi.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  {kpi.change}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Chart Area */}
      {chart && (
        <Card className="bg-muted/10 p-6 border-border/50">
          <h3 className="font-semibold mb-6">{chart.title}</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Optional Table */}
      {table && table.headers && (
        <Card className="bg-muted/10 overflow-hidden border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  {table.headers.map((header, i) => (
                    <th key={i} className="px-6 py-3 font-semibold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-6 py-4">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
