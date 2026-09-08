export default function Dashboard() {
  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-purdue-black">Welcome Back</h1>
        <p className="text-gray-500">Your BoilerHub Overview</p>
      </header>

      <section className="space-y-6">
        {/* Courses Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purdue-black">
          <h2 className="font-semibold text-lg mb-4 flex items-center">
            <span className="w-2 h-2 rounded-full bg-purdue-black mr-2"></span> Active Courses
          </h2>
          <ul className="text-gray-700 text-sm space-y-3">
            <li className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
              <span className="font-medium">CS 18000</span>
              <span className="text-xs text-gray-500">Problem Solving and Object-Oriented Programming</span>
            </li>
            <li className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
              <span className="font-medium">MA 16500</span>
              <span className="text-xs text-gray-500">Analytic Geometry and Calculus I</span>
            </li>
            <li className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
              <span className="font-medium">STAT 11300</span>
              <span className="text-xs text-gray-500">Statistics & Society</span>
            </li>
          </ul>
        </div>

        {/* Dining Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purdue-gold">
          <h2 className="font-semibold text-lg mb-4 flex items-center">
             <span className="w-2 h-2 rounded-full bg-purdue-gold mr-2"></span> Pinned Dining
          </h2>
          <div className="flex flex-col space-y-3">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md border border-gray-100">
              <span className="font-medium text-sm">Sushi Boss (Meredith South)</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">Open</span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md border border-gray-100">
              <span className="font-medium text-sm">Earhart Dining Court</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">Open</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
