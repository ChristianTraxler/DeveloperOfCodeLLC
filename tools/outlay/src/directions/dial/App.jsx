import React from 'react';
import './theme.css';
import { useData } from '../../data/DataContext.jsx';
import Header from './Header.jsx';
import Hero from './Hero.jsx';
import Ledger from './Ledger.jsx';
import Spending from './Spending.jsx';
import Billable from './Billable.jsx';
import Recurring from './Recurring.jsx';
import Taxes from './Taxes.jsx';
import Footer from './Footer.jsx';
import Dock from '../../shared/Dock.jsx';
import ExpenseSheet from '../../shared/ExpenseSheet.jsx';
import SubscriptionSheet from '../../shared/SubscriptionSheet.jsx';
import ReceiptViewer from '../../shared/ReceiptViewer.jsx';
import Toast from '../../shared/Toast.jsx';
import SignIn from '../../shared/SignIn.jsx';
import { ModeProvider } from '../../shared/mode.jsx';

const THEME_COLORS = { light: '#F2F3F5', dark: '#1A1D21' };

export default function App() {
  return (
    <ModeProvider native="light" storageKey="outlay:mode:dial" themeColors={THEME_COLORS}>
      <Screens />
    </ModeProvider>
  );
}

function Screens() {
  const { status, error } = useData();

  if (status === 'loading') return <div className="boot tone-light" aria-busy="true"><p className="boot-word" style={{ fontWeight: 300 }}>Outlay</p></div>;
  if (status === 'signed-out') return <><SignIn /><Toast /></>;
  if (status === 'error') {
    return (
      <div className="boot tone-light">
        <div className="wrap">
          <p className="boot-word" style={{ fontWeight: 300 }}>Outlay</p>
          <p className="d-lede">The ledger did not load: {error}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <a className="skip" href="#ledger">Skip to the ledger</a>
      <Header />
      <main id="top" tabIndex={-1}>
        <Hero />
        <Ledger />
        <Spending />
        <Billable />
        <Recurring />
        <Taxes />
      </main>
      <Footer />
      <Dock />
      <ExpenseSheet />
      <SubscriptionSheet />
      <ReceiptViewer />
      <Toast />
    </>
  );
}
