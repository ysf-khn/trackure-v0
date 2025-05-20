import React from "react";

export const Problems = () => {
  const painPoints = [
    "You spend hours figuring out where your items really are.",
    "Spreadsheets are a confusing, out-of-date mess.",
    "Items get stuck, and delays sneak up on you.",
    "Rework feels like starting from scratch, every single time.",
    "You can't confidently tell a buyer when their order will ship.",
  ];

  return (
    <section
      id="problems-section"
      className="relative w-full overflow-hidden py-24"
    >
      {/* Background effects */}
      {/* <div className="absolute inset-0 bg-gradient-to-b from-black to-blue-950/20"></div> */}
      {/* <div className="absolute left-0 right-0 top-1/4 h-96 w-full bg-blue-600/5 blur-3xl"></div> */}

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center">
          {/* Headline with glow effect */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-lg bg-blue-500/20 blur-xl"></div>
            <h2 className="relative z-10 max-w-7xl text-center text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Tired of Lost Items, Late Nights, and Unhappy Buyers?
            </h2>
          </div>

          {/* Pain points with animated hover effect */}
          <div className="mt-16 max-w-7xl">
            <ul className="grid gap-6 md:grid-cols-2">
              {painPoints.map((point, index) => (
                <li
                  key={index}
                  className="transform rounded-lg border border-blue-500/10 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-black/60 hover:shadow-lg hover:shadow-blue-500/5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                      <span className="text-lg font-bold text-blue-300">
                        {index + 1}
                      </span>
                    </div>
                    <p className="text-lg text-gray-300">{point}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Bridge line with highlight effect */}
          <div className="relative mt-16">
            <div className="absolute -inset-1 rounded-full bg-blue-500/10 blur-xl"></div>
            <p className="relative z-10 rounded-full bg-black/40 backdrop-blur-sm px-8 py-4 text-center text-xl font-medium text-blue-200">
              There's a simpler way to manage your export production.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
