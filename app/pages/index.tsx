import type { NextPage } from 'next';
import React, { forwardRef } from 'react';
import { SwapWindow } from '../features/swap';
import styles from '../styles/Home.module.css';

const Home: NextPage = forwardRef<any>(() => (
    <div className={styles.container}>
      <SwapWindow />
    </div>
));

Home.displayName = 'Home';

export default Home;
