'use client';

import LogRocket from 'logrocket';

// Initialize LogRocket only on the client side
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Replace 'your-app/your-app-id' with your actual LogRocket app ID
  LogRocket.init('your-app/your-app-id');
  
  // You can add user identification here if needed
  // LogRocket.identify('user-id', {
  //   name: 'User Name',
  //   email: 'user@example.com',
  // });
  
  console.log('LogRocket initialized on client');
}

export default function LogRocketInit() {
  // This is a dummy component that doesn't render anything
  // It's just used to ensure the LogRocket initialization code runs
  return null;
}