"use client";

import Link from "next/link";
import { ProgressBar } from "@tremor/react";
import { Target, TrendingUp, ArrowRightLeft, Briefcase } from "lucide-react";
import type { GrowthRecommendation } from "@/types/banking";

interface Props {
  recommendations: GrowthRecommendation[];
}

export default function GrowthRecommendations({ recommendations }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Growth Recommendations</h2>
            <p className="text-xs text-gray-400">Rule Engine — redirect excess spend to goals</p>
          </div>
        </div>

        {/* My Porto shortcut */}
        <Link
          href="/porto"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold text-indigo-700 transition-colors whitespace-nowrap"
        >
          <Briefcase className="w-3.5 h-3.5" />
          My Porto
        </Link>
      </div>

      {recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <Target className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">No active goals yet</p>
          <p className="text-xs text-gray-400 mt-1">
            The Rule Engine needs anomaly or forecast data to generate recommendations
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {recommendations.map((rec, i) => {
            const progress =
              rec.target_amount > 0
                ? Math.min(100, (rec.current_balance / rec.target_amount) * 100)
                : 0;

            return (
              <div
                key={rec.id ?? i}
                className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100"
              >
                {/* Goal header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-gray-900 text-sm">
                      {rec.target_goal}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm">
                    {progress.toFixed(1)}% saved
                  </span>
                </div>

                {/* Tremor ProgressBar */}
                <div className="mb-1">
                  <ProgressBar value={progress} color="emerald" className="mt-1" />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1.5 mb-4">
                  <span>Rp {rec.current_balance.toLocaleString("id-ID")}</span>
                  <span>Rp {rec.target_amount.toLocaleString("id-ID")}</span>
                </div>

                {/* Redirect amount */}
                {rec.recommended_redirect_amount != null && (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100 mb-3 shadow-sm">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                      <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Recommended monthly redirect</p>
                      <p className="text-sm font-bold text-emerald-700">
                        Rp {rec.recommended_redirect_amount.toLocaleString("id-ID")}
                        <span className="text-xs font-normal text-gray-400"> /month</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Impact message */}
                {rec.impact_message && (
                  <div className="p-3 bg-white rounded-xl border border-teal-100 shadow-sm">
                    <p className="text-xs text-teal-800 leading-relaxed">
                      {rec.impact_message}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
