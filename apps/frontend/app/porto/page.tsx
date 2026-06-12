import Link from "next/link";
import { Rocket, Construction, ArrowLeft, Sparkles } from "lucide-react";

export default function PortoPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">

        {/* Icon cluster */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Rocket className="w-9 h-9 text-white" />
          </div>
          {/* badge */}
          <span className="absolute -top-2 -right-2 flex items-center gap-1 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            <Construction className="w-3 h-3" />
            WIP
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
          My Porto
        </h1>
        <p className="text-sm text-indigo-600 font-semibold mb-4">
          Portfolio Intelligence — Coming Soon
        </p>

        {/* Divider */}
        <div className="border-t border-gray-100 my-5" />

        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed mb-2">
          Kami sedang membangun fitur portofolio cerdas yang akan menghubungkan
          data transaksimu dengan kinerja aset investasi secara real-time.
        </p>
        <p className="text-xs text-gray-400 leading-relaxed mb-6">
          Track saham, reksa dana, & kripto — semuanya dalam satu dashboard.
        </p>

        {/* Feature hints */}
        <div className="flex flex-col gap-2 mb-8 text-left">
          {[
            "Sinkronisasi otomatis dari Ajaib & Bibit",
            "Analisis risk-return berbasis ML",
            "Alert rebalancing dari wondr AI",
          ].map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-2.5 bg-indigo-50 rounded-xl px-4 py-2.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-xs text-indigo-700 font-medium">{feature}</span>
            </div>
          ))}
        </div>

        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </Link>
      </div>

      {/* Footer note */}
      <p className="mt-6 text-xs text-gray-400">
        wondr Intelligence Engine · fitur dalam pengembangan aktif
      </p>
    </div>
  );
}
