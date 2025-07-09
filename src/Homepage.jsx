import React, { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import MenuCreator from "./MenuCreator";
import CustomerManager from "./CustomerManager";
import Billing from './Billing'
import CustomerHistory from "./CustomerHistory";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function Homepage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <h1 className="text-4xl font-extrabold mb-10 tracking-tight text-gray-900">
        Maa Inti Vanta
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
        <Link to="/menu-creator" className="block">
          <Card className="transition-transform hover:scale-105 shadow-lg cursor-pointer">
            <CardContent className="flex flex-col items-center p-8">
              <span className="text-5xl mb-4">🍽️</span>
              <span className="text-2xl font-semibold">Menu Creation</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/billing" className="block">
          <Card className="transition-transform hover:scale-105 shadow-lg cursor-pointer">
            <CardContent className="flex flex-col items-center p-8">
              <span className="text-5xl mb-4">📜</span>
              <span className="text-2xl font-semibold">Billing</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/customers" className="block">
          <Card className="transition-transform hover:scale-105 shadow-lg cursor-pointer">
            <CardContent className="flex flex-col items-center p-8">
              <span className="text-5xl mb-4">👥</span>
              <span className="text-2xl font-semibold">Customer Management</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/customer-history" className="block">
          <Card className="transition-transform hover:scale-105 shadow-lg cursor-pointer">
            <CardContent className="flex flex-col items-center p-8">
              <span className="text-5xl mb-4">⌚</span>
              <span className="text-2xl font-semibold">Customer Order History</span>
            </CardContent>
          </Card>
        </Link>
      </div>
      <Button
        variant="outline"
        className="mt-12"
        onClick={() => signOut(auth)}
      >
        Logout
      </Button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  if (!user) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/menu-creator" element={<MenuCreator />} />
      <Route path="/customers" element={<CustomerManager />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/customer-history" element={<CustomerHistory />} />
    </Routes>
  );
}
