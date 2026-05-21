// components/Navbar.tsx
import { Show, SignInButton, SignUpButton, UserAvatar, useClerk, useUser } from '@clerk/react';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Bars3Icon, TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import LoadingSkeleton from './LoadingSkeleton';

const navigation = [
  { name: 'Gacha', href: '/gacha' },
  { name: 'Collection', href: '/collection' },
  { name: 'Inventory', href: '/inventory'},
  { name: 'Shop', href: '/shop' },
  { name: 'Battle', href: '/battle' },
  { name: 'Market', href: '/market' },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const location = useLocation();
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const [currency, setCurrency] = useState(0);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [userAchievements, setUserAchievements] = useState<any[]>([]);

  useEffect(() => {
    if (isSignedIn && user) {
      apiClient.getCurrency()
        .then(data => setCurrency(data.currency ?? 0))
        .catch(err => console.error('Failed to fetch currency:', err));

      apiClient.getAchievements()
        .then(data => setAchievements(data.achievements || []))
        .catch(err => console.error('Failed to fetch achievements:', err));

      apiClient.getUserAchievements()
        .then(data => setUserAchievements(data.userAchievements || []))
        .catch(err => console.error('Failed to fetch user achievements:', err));
    }
  }, [isSignedIn, user]);

  if (!isLoaded) {
    return <LoadingSkeleton />;
  }

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const getUserProgress = (achievementId: number) => {
    const userAchievement = userAchievements.find(ua => ua.achievement_id === achievementId);
    return userAchievement || { progress: 0, completed_at: null };
  };

  return (
    <Disclosure
      as="nav"
      className="relative bg-gray-800/50 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white/10"
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white focus:outline-2 focus:-outline-offset-1 focus:outline-indigo-500">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
              <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
            </DisclosureButton>
          </div>
          
          <div className="flex flex-1 items-center justify-center sm:justify-start">
            <div className="flex shrink-0 items-center">
              <Link to="/">
                <img
                  alt="Gatch It All!"
                  src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
                  className="h-8 w-auto"
                />
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:block">
              <div className="flex space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={classNames(
                      location.pathname === item.href
                        ? 'bg-gray-950/50 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white',
                      'rounded-md px-3 py-2 text-sm font-medium',
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            <Show when="signed-in">
              <div className='mr-2'>
                <span className='select-none'>${currency}</span>
              </div>
              <Menu as="div">
                <MenuButton className="relative rounded-full p-1 text-gray-400 hover:text-white focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500">
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">View achievements</span>
                  <TrophyIcon aria-hidden="false" className="size-6" />
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute z-10 mt-10 left-1/2 -translate-x-1/2 max-sm:-translate-x-1/2 max-sm:left-[-20vw] w-screen mx-auto max-w-md sm:max-w-8/9 min-h-[75vh] max-h-[75vh] overflow-y-auto rounded-md bg-gray-800 py-1 outline -outline-offset-1 outline-white/10 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                >
                  <MenuItem>
                    <h1 className='text-center text-white text-xl font-bold'>Achievements</h1>
                  </MenuItem>

                  <MenuItem>
                    <div className=" columns-1 sm:columns-2 gap-6 space-y-6 p-4">
                      {achievements.map((achievement: any) => {
                        const progress = getUserProgress(achievement.id);
                        const isCompleted = progress.completed_at !== null;
                        return (
                          <div key={achievement.id} className={`bg-gray-900 rounded-lg p-2 md:p-4 ${isCompleted ? 'border-2 border-green-400' : ''}`}>
                            {/* Always side-by-side, never stacked */}
                            <div className="flex gap-2 md:gap-4">
                              <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 overflow-hidden rounded-lg">
                                <img 
                                  src={achievement.image_url} 
                                  alt={achievement.name} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <div className='flex flex-col justify-center min-w-0'>
                                <h3 className="text-white text-xs md:text-sm font-semibold truncate">{achievement.name}</h3>
                                <p className="text-gray-400 text-[10px] md:text-xs wrap-break-word"> {achievement.description} </p>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-1 md:gap-2">
                              <div className="flex-1 h-1 md:h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-400 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${(progress.progress / (achievement.value_int || achievement.value_float || 100)) * 100}%` 
                                  }}
                                />
                              </div>
                              <p className="text-gray-400 text-[9px] md:text-xs whitespace-nowrap">
                                {progress.progress >= (achievement.value_int || achievement.value_float || 100) ? (
                                    ''
                                  ) : (
                                    `${progress.progress}/${achievement.value_int || achievement.value_float || 100}`
                                  )}
                              </p>
                              {isCompleted && <span className="text-green-400 text-xs">✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </MenuItem>
                </MenuItems>
              </Menu>
              
              <Menu as="div" className="relative ml-3">
                <MenuButton className="relative flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">Open user menu</span>
                  <UserAvatar />
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-gray-800 py-1 outline -outline-offset-1 outline-white/10 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                >
                  <MenuItem>
                    <Link to="/stats" className="block px-4 py-2 text-sm text-gray-300 data-focus:bg-white/5 data-focus:outline-hidden">
                      Your stats
                    </Link>
                  </MenuItem>
                  <MenuItem>
                    <Link to="/profile" className="block px-4 py-2 text-sm text-gray-300 data-focus:bg-white/5 data-focus:outline-hidden">
                      Your profile
                    </Link>
                  </MenuItem>
                  <MenuItem>
                    <Link to="/settings" className="block px-4 py-2 text-sm text-gray-300 data-focus:bg-white/5 data-focus:outline-hidden">
                      Settings
                    </Link>
                  </MenuItem>
                  <MenuItem>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-red-300 data-focus:bg-red-500/10"
                    >
                      Sign out
                    </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            </Show>
            
            <Show when="signed-out">
              <SignInButton>
                <button className="mr-4 bg-blue-500 hover:bg-blue-400 text-white dark:text-white dark:bg-blue-700 hover:dark:bg-blue-600 rounded-lg px-6 py-2 ring shadow-xl ring-gray-900/5">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="bg-white hover:bg-gray-100 text-black dark:bg-gray-800 hover:dark:bg-gray-700 dark:text-gray-400 rounded-lg px-6 py-2 ring shadow-xl ring-gray-900/5">
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
          </div>
        </div>
      </div>

      <DisclosurePanel className="sm:hidden">
        <div className="space-y-1 px-2 pt-2 pb-3">
          {navigation.map((item) => (
            <DisclosureButton
              key={item.name}
              as={Link}
              to={item.href}
              className={classNames(
                location.pathname === item.href
                  ? 'bg-gray-950/50 text-white'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white',
                'block rounded-md px-3 py-2 text-base font-medium',
              )}
            >
              {item.name}
            </DisclosureButton>
          ))}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}