import Link from "next/link";
import { FeedbackLink } from "@/components/ui/FeedbackLink";
import Image from "next/image";

export default function LandingPage() {
  const colleges = [
    { name: "IIT Bombay", logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuB-VEHPfW2toUR8Mg_ffIznNJoXdbu_2_u1PNSLd6sLQic0OOcBf1LTAcIdWvrGx5ZvdHSv6Q3796Iv_X_EyWA2GqVK5KACVVmvYOuWfAPDPuLccx-6Weo95W0lqw-vpNwYTjsy-RD4RMoKIUznOSPqmD5e5wymCI7l5LtWBq3AkaWKgoEXId46dfN6C0iK5Wc465qZi1g-T991IqjjyvekjMSTPHdVKybIgxpnls6Te6ir4XfPk7zbB9q3LUzMiBHu02IJAYU-gHBT" },
    { name: "VIT", logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuD3FCa6DKuDEaP98wk6NZ-oA4Fqrw2IGqxkY_HmLWr81VPRcyE8Msza6pkzxQFDkM30KirPHZ5jldzQq4gSuEfB1XiA5C-6SKQedlno3yTAlOtblYdHNo4IifW8s44P0e8CWwnKbNhHbfxf_tEEYXu8XK_pIesBtVkAWyDWkkypL8uWpbjuiHzLe0pxzG8vPNifYsa8gLthn8-UG7z7awTzxbCLDXFiissol-DDnYo_E1JTJF_jdg53fYS1qUKeu6by-z_4C1jBfm9-" },
    { name: "Anna University", logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuCOXJlUMM608HVPOWazs-Tbfh9Z7BwR8ma4UGEFkjr1K6_kXEwOBopcxfMGpvvT98IO7ebCcD0d0XtSPYA105bxa715KePssHUd8NG82aogsynFam3AbzGgebZ2FJdCZCal7pPzGSVkR_74jJL861ckyiMLFBWO9_F489Qd6VFlzgtSQdGtQXzYp6YN1huEyNIhajjF5WCy4_l_ssglUsPJlL45ZyLKT9HrWZS8PDXFevWVSYU0mwzfLpGAYwzUXGNiRFeHXz23zU14" },
    { name: "BITS Pilani", logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuAQFSQrcoeGl2O-0FwWE5KsSEBfX4RMO8Of_lKzrbg1R5eoTajvWU1AvWVFb9UT0zyiTgvLdk3UBPtxdeE2wmUyhr5-hYiLSQmVFcS3XGPP6s2r_oxIPXzFATaZawARVFZP6xfoDpN0IfrNcAbv8I7Dn68QRjtaxOjy9f-ylon979I4jBxt-MmA0InnaGcAUfvipjidKO4AlnSvPEdpYJNZrlsq6a8D_5yG0KRq16lC_AnFZAGmYj-xLEqkcgfuFDyIi48WRvt59qzs" },
  ];

  return (
    <div className="bg-[#0A0A0A] text-gray-100 min-h-screen flex flex-col relative overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-full h-2/3 bg-cover bg-center opacity-10 mix-blend-color-dodge"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }}
        />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to from-[#0A0A0A] via-[#0A0A0A] to-transparent z-10" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to from-[#0A0A0A]/80 via-transparent to-[#0A0A0A] z-10" />
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-red-900/20 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <main className="relative z-20 grow flex flex-col items-center justify-center px-6 py-12 w-full max-w-md mx-auto">
        {/* Logo Section */}
        <div className="w-full flex flex-col items-center mb-12 animate-fade-in-up">
          <div className="relative z-10 text-center">
            <img src="/only-founders-logo.png" alt="OnlyFounders Logo" className="mx-auto h-32 w-auto" />
          </div>

          <p className="text-white text-lg font-light tracking-wide text-center opacity-90 pt-6 w-3/4 mx-auto">
            The One Of Kind Hackathon Platform For Student Founders
          </p>
        </div>

        {/* CTA Section */}
        <div className="w-full space-y-6 flex flex-col items-center">
          <FeedbackLink
            href="/auth/login"
            className="group relative w-full overflow-hidden bg-primary hover:bg-primary-hover text-black font-medium py-4 px-8 text-center transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] border border-yellow-600/50"
            feedbackType="success"
          >
            <span className="relative z-10 flex items-center justify-center tracking-widest uppercase text-sm font-bold">
              Enter Platform
              <svg
                className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
            <div className="absolute inset-0 h-full w-full scale-0 rounded-none transition-all duration-300 group-hover:scale-100 group-hover:bg-white/20" />
          </FeedbackLink>

          <Link
            href="/follow-us"
            className="text-gray-400 hover:text-white text-xs tracking-widest uppercase border-b border-transparent hover:border-primary transition-all duration-300 pb-1"
          >
            Follow Us On Instagram
          </Link>

          <div className="flex items-center space-x-2 text-xs text-gray-500 uppercase tracking-widest mt-8">
            <span className="h-px w-8 bg-gray-800" />
            <span>For Founders By Founders</span>
            <span className="h-px w-8 bg-gray-800" />
          </div>
        </div>
      </main>

      {/* Footer with College Logos */}
      <footer className="relative z-20 w-full py-8 bg-surface-elevated border-t border-[#2A2A2A]">
        <div className="max-w-md mx-auto px-6 overflow-hidden">
          <div className="flex justify-between items-center space-x-6 opacity-80 overflow-x-auto pb-2 scrollbar-hide">
            {colleges.map((college) => (
              <div
                key={college.name}
                className="shrink-0 college-logo-mask"
                title={college.name}
              >
                <Image
                  src={college.logo}
                  alt={college.name}
                  width={40}
                  height={40}
                  className="h-10 w-auto object-contain"
                  unoptimized
                />
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <p className="text-[10px] text-gray-600 tracking-widest font-sans">
              © 2026 ONLYFOUNDERS. EXCLUSIVE ACCESS.
            </p>
          </div>
        </div>
      </footer>

      {/* Corner Decorative Dots */}
      <div className="fixed top-4 left-4 z-50">
        <div className="h-1 w-1 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#FFD700]" />
      </div>
      <div className="fixed top-4 right-4 z-50">
        <div className="h-1 w-1 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#FFD700]" />
      </div>
      <div className="fixed bottom-4 left-4 z-50">
        <div className="h-1 w-1 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#FFD700]" />
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        <div className="h-1 w-1 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#FFD700]" />
      </div>

      {/* Mobile Border Effect */}
      <div className="pointer-events-none fixed inset-0 z-50 border-[0.5px] border-white/5 sm:hidden" />
    </div>
  );
}
