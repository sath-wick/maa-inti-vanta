import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "./firebase";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export default function Dashboards() {
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");

  // Fetch all customer orders
  useEffect(() => {
  const ordersRef = ref(database, "customerOrderHistory");

  onValue(ordersRef, snapshot => {
    const data = snapshot.val() || {};
    const allOrders = [];

    Object.entries(data).forEach(([customerId, customerObj]) => {
      if (customerObj.orders) {
        Object.entries(customerObj.orders).forEach(([orderId, order]) => {
          const customerName = order.customerName || "Unknown"; // 🔥 Correct place to get name
          allOrders.push({
            ...order,
            customerId,
            orderId,
            customerName
          });
        });
      }
    });

    setOrders(allOrders);
  });
}, []);


  // Filter orders by selected date (yyyy-mm-dd)
  const filteredOrders = selectedDate
    ? orders.filter(order => order.date === selectedDate)
    : [];

  // Construct Cooking Dashboard: meal → item → total quantity
  const cookingDashboard = {
    breakfast: {},
    lunch: {},
    dinner: {}
  };

  // Construct Packaging Dashboard: meal → customer → itemMap + charges
  const packagingDashboard = {
    breakfast: {},
    lunch: {},
    dinner: {}
  };

  filteredOrders.forEach(order => {
    const { mealType, items, customerName, deliveryCharges = 0, grandTotal = 0 } = order;

    // Cooking dashboard aggregation
    items.forEach(item => {
      if (!cookingDashboard[mealType][item.name]) {
        cookingDashboard[mealType][item.name] = 0;
      }
      cookingDashboard[mealType][item.name] += item.quantity;
    });

    // Packaging dashboard aggregation
    if (!packagingDashboard[mealType][customerName]) {
      packagingDashboard[mealType][customerName] = {
        itemMap: {},
        deliveryCharges,
        grandTotal
      };
    }

    items.forEach(item => {
      if (!packagingDashboard[mealType][customerName].itemMap[item.name]) {
        packagingDashboard[mealType][customerName].itemMap[item.name] = {
          quantity: 0,
          price: item.price
        };
      }
      packagingDashboard[mealType][customerName].itemMap[item.name].quantity += item.quantity;
    });
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-white">
      <div>
        <Label className="text-lg font-bold">Select Date</Label>
        <Input
          type="date"
          className="mt-2 bg-[#23272f] text-white"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {selectedDate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 🔥 Cooking Dashboard */}
          <div className="bg-[#23272f] p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🔥 Cooking Dashboard</h2>
            {["breakfast", "lunch", "dinner"].map((meal) => (
              <div key={meal} className="mb-4">
                <h3 className="text-lg font-bold capitalize">{meal}</h3>
                {Object.keys(cookingDashboard[meal]).length === 0 ? (
                  <p className="text-gray-400">No items</p>
                ) : (
                  <ul className="ml-4 list-disc space-y-1 text-sm">
                    {Object.entries(cookingDashboard[meal]).map(([itemName, qty]) => (
                      <li key={itemName}>
                        {itemName} - {qty}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* 📦 Packaging Dashboard */}
          <div className="bg-[#23272f] p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">📦 Packaging Dashboard</h2>
            {["breakfast", "lunch", "dinner"].map((meal) => (
              <div key={meal} className="mb-6">
                <h3 className="text-lg font-bold capitalize">{meal}</h3>
                {Object.keys(packagingDashboard[meal]).length === 0 ? (
                  <p className="text-gray-400">No orders</p>
                ) : (
                  Object.entries(packagingDashboard[meal]).map(([customerName, info]) => (
                    <div key={customerName} className="mb-4 ml-4 pl-3 border-l border-gray-600">
                      <h4 className="font-semibold text-base">{customerName}</h4>
                      <ul className="ml-4 list-disc space-y-1 text-sm">
                        {Object.entries(info.itemMap).map(([item, { quantity, price }]) => (
                          <li key={item}>
                            {item} - ₹{price} × {quantity} = ₹{price * quantity}
                          </li>
                        ))}
                      </ul>
                      <div className="text-sm ml-2 mt-1">
                        Delivery Charges: ₹{info.deliveryCharges}<br />
                        Grand Total: <b>₹{info.grandTotal}</b>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
