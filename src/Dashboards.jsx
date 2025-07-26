import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "./firebase";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const mealTypes = [
  { label: "Select Meal Type", value: "" },
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Bakery", value: "bakery" }, // new meal type
];

// Utility to get today's date in yyyy-MM-dd format
const getTodayYYYYMMDD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function Dashboards() {
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayYYYYMMDD());
  const [selectedMealType, setSelectedMealType] = useState("");

  // Fetch all customer orders once
  useEffect(() => {
    const ordersRef = ref(database, "customerOrderHistory");

    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const allOrders = [];

      Object.entries(data).forEach(([customerId, customerObj]) => {
        if (customerObj.orders) {
          Object.entries(customerObj.orders).forEach(([orderId, order]) => {
            allOrders.push({
              ...order,
              customerId,
              orderId,
              customerName: order.customerName || "Unknown",
            });
          });
        }
      });

      setOrders(allOrders);
    });

    return () => unsubscribe();
  }, []);

  // Filter orders by selected date
  const filteredOrders = selectedDate
    ? orders.filter((order) => order.date === selectedDate)
    : [];

  // Prepare dashboard data placeholders for all meal types including bakery
  const cookingDashboard = {
    breakfast: {},
    lunch: {},
    dinner: {},
    bakery: {},
  };
  const packagingDashboard = {
    breakfast: {},
    lunch: {},
    dinner: {},
    bakery: {},
  };

  // Build dashboard stats only if meal type is selected, otherwise do nothing
  if (selectedMealType) {
    filteredOrders.forEach((order) => {
      const {
        mealType,
        items = [],
        customerName = "Unknown",
        deliveryCharges = 0,
        grandTotal = 0,
      } = order;

      // Only aggregate if mealType matches selected
      if (mealType !== selectedMealType) return;

      // Defensive - initialize if absent
      if (!cookingDashboard[mealType]) cookingDashboard[mealType] = {};
      if (!packagingDashboard[mealType]) packagingDashboard[mealType] = {};

      // Aggregate cooking dashboard (item quantities)
      items.forEach((item) => {
        if (!cookingDashboard[mealType][item.name]) {
          cookingDashboard[mealType][item.name] = 0;
        }
        cookingDashboard[mealType][item.name] += item.quantity;
      });

      // Aggregate packaging dashboard
      if (!packagingDashboard[mealType][customerName]) {
        packagingDashboard[mealType][customerName] = {
          itemMap: {},
          deliveryCharges,
          grandTotal,
        };
      }

      items.forEach((item) => {
        const itemMap = packagingDashboard[mealType][customerName].itemMap;
        if (!itemMap[item.name]) {
          itemMap[item.name] = { quantity: 0, price: item.price || 0 };
        }
        itemMap[item.name].quantity += item.quantity;
      });
    });
  }

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

      <div>
        <Label className="text-lg font-bold mt-4">Select Meal Type</Label>
        <select
          value={selectedMealType}
          onChange={(e) => setSelectedMealType(e.target.value)}
          className="mt-2 bg-[#23272f] text-white p-2 rounded w-full md:w-64"
        >
          {mealTypes.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {selectedMealType ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Cooking Dashboard */}
          <div className="bg-[#23272f] p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🔥 Cooking Dashboard</h2>
            {Object.keys(cookingDashboard[selectedMealType]).length === 0 ? (
              <p className="text-gray-400">No items</p>
            ) : (
              <ul className="ml-4 list-disc space-y-1 text-sm">
                {Object.entries(cookingDashboard[selectedMealType]).map(
                  ([itemName, qty]) => (
                    <li key={itemName}>
                      {itemName} - {qty}
                    </li>
                  )
                )}
              </ul>
            )}
          </div>

          {/* Packaging Dashboard */}
          <div className="bg-[#23272f] p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">📦 Packaging Dashboard</h2>
            {Object.keys(packagingDashboard[selectedMealType]).length === 0 ? (
              <p className="text-gray-400">No orders</p>
            ) : (
              Object.entries(packagingDashboard[selectedMealType]).map(
                ([customerName, info]) => (
                  <div
                    key={customerName}
                    className="mb-4 ml-4 pl-3 border-l border-gray-600"
                  >
                    <h4 className="font-semibold text-base">{customerName}</h4>
                    <ul className="ml-4 list-disc space-y-1 text-sm">
                      {Object.entries(info.itemMap).map(
                        ([item, { quantity, price }]) => (
                          <li key={item}>
                            {item} - ₹{price} × {quantity} = ₹{price * quantity}
                          </li>
                        )
                      )}
                    </ul>
                    <div className="text-sm ml-2 mt-1">
                      Delivery Charges: ₹{info.deliveryCharges}
                      <br />
                      Grand Total: <b>₹{info.grandTotal}</b>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
      ) : (
        <p className="text-gray-400 mt-6">Please select a meal type to view the dashboard data.</p>
      )}
    </div>
  );
}
