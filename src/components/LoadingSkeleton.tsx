export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar skeleton */}
      <div className="h-16 bg-gray-800/50 animate-pulse">
        <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 h-full flex items-center">
          <div className="h-8 w-32 bg-gray-700 rounded"></div>
          <div className="ml-6 hidden sm:flex space-x-4">
            <div className="h-8 w-16 bg-gray-700 rounded"></div>
            <div className="h-8 w-16 bg-gray-700 rounded"></div>
            <div className="h-8 w-16 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
      
      {/* Page content skeleton */}
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8"></div>
    
    </div>
  );
}