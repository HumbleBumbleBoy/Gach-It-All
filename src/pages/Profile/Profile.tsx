import Navbar from '../../components/Navbar';
import { Show, UserProfile, useUser } from '@clerk/react';
import { useEffect } from 'react';
import { apiClient } from '../../../lib/api';

export default function Profile() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      apiClient.userLogin()
        .then(data => console.log('Backend response:', data))
        .catch(err => console.error('Error calling backend:', err));
    }
  }, [isSignedIn, user]);

  return (
    <>
      <Navbar />
      <main>
        <div className="mx-auto">
          <Show when="signed-in">
            <div className="flex justify-center">
              <div className="">
                <div className="mb-8 text-center">
                  <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
                </div>

                <div className="bg-gray-800/30 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-700/50 overflow-hidden">
                  <UserProfile />
                </div>
              </div>
            </div>
          </Show>
          
          <Show when="signed-out">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="bg-gray-800/50 rounded-2xl p-8 text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Not Signed In</h2>
                <p className="text-gray-400 mb-6">Please sign in to view and edit your profile settings.</p>
                <button 
                  onClick={() => window.location.href = '/sign-in'}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors mt-4"
                >
                  Sign In
                </button>
              </div>
            </div>
          </Show>
        </div>
      </main>
    </>
  );
}