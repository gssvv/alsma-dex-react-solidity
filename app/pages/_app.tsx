import '../styles/globals.css';
import React from 'react';
import { AppProps } from 'next/app';
import { Header } from '../common/entry/layout/Header/Header';

function MyApp({ Component }: AppProps) {
  return (
     <div>
       <Header />
       <Component />
     </div>
  );
}

export default MyApp;
