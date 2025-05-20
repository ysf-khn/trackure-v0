import Image from "next/image";

export const Solutions = () => {
  return (
    <section className="w-full py-20 px-4 md:px-8 lg:px-16 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Take Control with Trakure.
            <br />
            Know Everything, Instantly.
          </h1>
        </div>

        {/* Main Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Feature 1 */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-blue-500/10 hover:border-blue-500/30 transition-all duration-300">
            <div className="relative h-48 bg-gradient-to-br from-blue-900/20 via-black/40 to-black/60 rounded-lg mb-6 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src="/tracking.png"
                  alt="Item Tracking Preview"
                  width={400}
                  height={300}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent"></div>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">
              Real-time Item Tracking
            </h3>
            <p className="text-gray-300">
              Always know where every item is, instantly. See its exact stage in
              your workflow – from manufacturing and customization to finishing
              and packing – all in one clear, live view.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-blue-500/10 hover:border-blue-500/30 transition-all duration-300">
            <div className="relative h-48 bg-gradient-to-br from-blue-900/20 via-black/40 to-black/60 rounded-lg mb-6 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src="/rework.png"
                  alt="Rework Management Preview"
                  width={400}
                  height={300}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent"></div>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">
              Smart Rework Management
            </h3>
            <p className="text-gray-300">
              Make rework clear and controlled. If an item needs fixing, easily
              send it back to the correct previous step with clear notes on
              what's needed. Get corrections done faster.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-blue-500/10 hover:border-blue-500/30 transition-all duration-300">
            <div className="relative h-48 bg-gradient-to-br from-blue-900/20 via-black/40 to-black/60 rounded-lg mb-6 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src="/truth.png"
                  alt="Single Source Preview"
                  width={400}
                  height={300}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent"></div>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">
              Single Source of Truth
            </h3>
            <p className="text-gray-300">
              Ditch the messy, out-of-date spreadsheets. Everyone on your team
              sees the same up-to-date information, reducing errors and saving
              time.
            </p>
          </div>
        </div>

        {/* Additional Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-blue-500/10 hover:border-blue-500/30 transition-all duration-300">
            <h3 className="text-xl font-semibold mb-6 text-white">
              Proactive Delay Prevention
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/60 rounded-lg p-4">
                <p className="text-gray-300 text-sm">
                  Spot delays before they cost you
                </p>
              </div>
              <div className="bg-black/60 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Track stage duration</p>
              </div>
              <div className="bg-black/60 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Get timely reminders</p>
              </div>
              <div className="bg-black/60 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Prevent stockouts</p>
              </div>
            </div>
            <p className="text-gray-300">
              Never forget critical materials again. Get timely reminders to
              order specific boxes, inserts, or supplies so your items are ready
              to ship without last-minute panics.
            </p>
          </div>

          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-blue-500/10 hover:border-blue-500/30 transition-all duration-300">
            <h3 className="text-xl font-semibold mb-6 text-white">
              Complete Documentation
            </h3>
            <div className="relative h-48 bg-gradient-to-br from-blue-900/20 via-black/40 to-black/60 rounded-lg mb-6 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src="/history.png"
                  alt="Documentation Features"
                  width={400}
                  height={300}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent"></div>
            </div>
            <p className="text-gray-300">
              Keep a clear history of every item. See every move, every note,
              every rework for full traceability. Generate vouchers and basic
              invoices when you need them.
            </p>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-blue-200 text-xl max-w-4xl mx-auto bg-black/40 backdrop-blur-sm rounded-full px-8 py-4">
            This means less stress, fewer mistakes, and more on-time exports for
            your business.
          </p>
        </div>
      </div>
    </section>
  );
};
