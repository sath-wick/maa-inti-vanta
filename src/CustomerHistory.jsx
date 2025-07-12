import React, { useEffect, useState } from "react";
import { ref, onValue, remove, update } from "firebase/database";
import { database } from "./firebase";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { format, parse } from "date-fns";

// Define meal labels for display purposes
const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner"
};

// Helper function to convert 'yyyy-MM-dd' to 'dd-MM-yyyy' for display
function toDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  return format(d, "dd-MM-yyyy");
}

// Helper function to convert 'dd-MM-yyyy' to 'yyyy-MM-dd' for internal use (Firebase)
function toYYYYMMDD(dateStr) {
  if (!dateStr) return "";
  const d = parse(dateStr, "dd-MM-yyyy", new Date());
  return format(d, "yyyy-MM-dd");
}

// Simple SVG component for the three-dot icon
function ThreeDotIcon(props) {
  return (
    <svg width={24} height={24} {...props} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

export default function OrderHistorySummary() {
  const today = format(new Date(), "dd-MM-yyyy"); // Default date to today's date in dd-MM-yyyy format
  const [selectedDate, setSelectedDate] = useState(today); // State for the date filter
  const [allOrders, setAllOrders] = useState([]); // Stores all fetched orders from Firebase
  const [search, setSearch] = useState(""); // State for customer search filter
  const [menuAnchor, setMenuAnchor] = useState(null); // Stores the customerId for which the 3-dot menu is open

  // Effect hook to fetch all customer order history from Firebase on component mount
  useEffect(() => {
    const ordersRef = ref(database, "customerOrderHistory");
    const unsubscribe = onValue(ordersRef, snap => {
      const data = snap.val() || {};
      const loadedOrders = [];
      // Iterate through customers and their orders to flatten the structure
      Object.entries(data).forEach(([customerId, customerData]) => {
        if (customerData.orders) {
          Object.entries(customerData.orders).forEach(([orderId, order]) => {
            loadedOrders.push({
              ...order,
              customerId,
              customerName: order.customerName || customerData.name || "", // Ensure customer name is available
              orderId
            });
          });
        }
      });
      setAllOrders(loadedOrders); // Update the state with fetched orders
    });
    return () => unsubscribe(); // Cleanup function to detach the listener on unmount
  }, []);

  // Filter orders based on the selected date. If no date is selected (cleared), show all orders.
  const filteredOrders = selectedDate
    ? allOrders.filter(order => order.date === toYYYYMMDD(selectedDate))
    : allOrders;

  // --- SUMMARY LOGIC ---
  // Initialize objects to aggregate data for the summary section
  const summaryMeals = { breakfast: {}, lunch: {}, dinner: {} };
  const mealTotals = { breakfast: 0, lunch: 0, dinner: 0 };
  const deliveryTotals = { breakfast: 0, lunch: 0, dinner: 0 };

  // Populate summary data by iterating through filtered orders
  filteredOrders.forEach(order => {
    const meal = order.mealType;
    if (!mealLabels[meal]) return; // Skip if mealType is not recognized (e.g., 'unknown')
    order.items.forEach(item => {
      // Aggregate item quantities and ensure price is stored for calculation
      if (!summaryMeals[meal][item.name]) {
        summaryMeals[meal][item.name] = { quantity: 0, price: item.price };
      }
      summaryMeals[meal][item.name].quantity += item.quantity;
    });
    // Calculate total earnings from items and delivery charges for each meal
    mealTotals[meal] += order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    deliveryTotals[meal] += Number(order.deliveryCharges || 0);
  });

  // --- INDIVIDUAL CUSTOMER HISTORY LOGIC ---
  // Create a map to group orders by customer for the detailed history view
  const customerMap = {};
  filteredOrders.forEach(order => {
    const id = order.customerId;
    if (!customerMap[id]) {
      customerMap[id] = { name: order.customerName, meals: {}, orderIds: {} };
    }
    const meal = order.mealType;
    if (!customerMap[id].meals[meal]) {
      customerMap[id].meals[meal] = [];
    }
    customerMap[id].meals[meal].push({ ...order }); // Add the full order object
    customerMap[id].orderIds[order.orderId] = order; // Store order by ID for quick lookup (e.g., for item removal)
  });

  // --- ACTION HANDLERS ---

  // Handles the deletion of an entire customer record from Firebase
  const handleDeleteCustomer = async (customerId) => {
    setMenuAnchor(null); // Close the 3-dot menu
    if (window.confirm("Are you sure you want to delete ALL orders for this customer? This action cannot be undone.")) {
      await remove(ref(database, `customerOrderHistory/${customerId}`));
    }
  };

  // Placeholder for the "Edit" customer functionality
  const handleEditCustomer = (customerId) => {
    setMenuAnchor(null); // Close the 3-dot menu
    alert(`Edit functionality for customer ${customerId} is not yet implemented.`);
  };

  // Handles the deletion of all orders for a specific meal for a customer on the selected date
  const handleDeleteMeal = async (customerId, meal) => {
    if (!window.confirm(`Are you sure you want to delete all ${meal} orders for this customer for the selected date?`)) return;
    // Get all order IDs for the specified meal for the current customer
    const ordersToDelete = (customerMap[customerId].meals[meal] || []).map(o => o.orderId);
    // Remove each order individually
    for (const orderId of ordersToDelete) {
      await remove(ref(database, `customerOrderHistory/${customerId}/orders/${orderId}`));
    }
  };

  // Handles the removal of a single item from an order
  const handleRemoveItem = async (customerId, orderId, itemIdx) => {
    const order = customerMap[customerId].orderIds[orderId]; // Get the specific order
    const newItems = order.items.filter((_, idx) => idx !== itemIdx); // Filter out the item to be removed

    if (newItems.length === 0) {
      // If no items remain in the order, delete the entire order
      await remove(ref(database, `customerOrderHistory/${customerId}/orders/${orderId}`));
    } else {
      // Otherwise, update the order with the remaining items
      await update(ref(database, `customerOrderHistory/${customerId}/orders/${orderId}`), { items: newItems });
    }
  };

  // Calculate the grand total for all items and delivery charges across all meals
  const grandTotal =
    Object.values(mealTotals).reduce((a, b) => a + b, 0) +
    Object.values(deliveryTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-8 bg-[#181c23] rounded-lg">
      {/* Date selection and filter */}
      <div className="flex flex-col md:flex-row gap-2 items-center mb-2">
        <label className="text-gray-200 font-bold">Select date:</label>
        <Input
          type="date" // Use type="date" for native date picker UI
          value={toYYYYMMDD(selectedDate)} // Convert dd-MM-yyyy to yyyy-MM-dd for input value
          onChange={e => setSelectedDate(toDDMMYYYY(e.target.value))} // Convert input value back to dd-MM-yyyy for state
          className="w-full md:w-auto p-2 rounded bg-[#23272f] text-gray-100"
        />
        <button
          className="ml-2 px-3 py-2 bg-gray-700 text-gray-100 text-xs rounded"
          onClick={() => setSelectedDate("")} // Clear the date filter to show all orders
        >
          Clear
        </button>
      </div>

      {/* --- SUMMARY SECTION --- */}
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Summary</h2>
        {Object.entries(mealLabels).map(([mealKey, mealLabel]) => (
          <div key={mealKey} className="mb-4">
            <div className="font-semibold text-lg text-gray-200 mb-1">{mealLabel}</div>
            {Object.keys(summaryMeals[mealKey]).length === 0 ? (
              <div className="text-gray-400 text-sm mb-2">No orders</div>
            ) : (
              <table className="w-full mb-1" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  {Object.entries(summaryMeals[mealKey]).map(([itemName, item]) => (
                    <tr key={itemName} style={{ border: "none" }}>
                      <td
                        className="py-1 px-1 text-gray-100"
                        style={{ verticalAlign: "middle", width: "33%" }}
                      >
                        {itemName}
                      </td>
                      <td
                        className="py-1 px-1 text-gray-100 text-center"
                        style={{ verticalAlign: "middle", width: "33%" }}
                      >
                        {item.quantity}
                      </td>
                      <td
                        className="py-1 px-1 text-gray-100 text-right"
                        style={{ verticalAlign: "middle", width: "33%" }}
                      >
                        ₹{item.price * item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Display meal-specific totals (items and delivery) */}
            <div className="flex justify-between text-gray-300 text-sm mb-0">
              <span>Total:</span>
              <span>₹{mealTotals[mealKey]}</span>
            </div>
            <div className="flex justify-between text-gray-300 text-sm mb-2">
              <span>Delivery total:</span>
              <span>₹{deliveryTotals[mealKey]}</span>
            </div>
          </div>
        ))}
        {/* Display the grand total for all meals */}
        <div className="flex justify-between text-lg font-bold text-white border-t border-gray-600 pt-2 mt-2">
          <span>GRAND TOTAL:</span>
          <span>₹{grandTotal}</span>
        </div>
      </div>

      {/* --- INDIVIDUAL CUSTOMER HISTORY SECTION --- */}
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Individual customer history</h2>
        {/* Customer search input */}
        <Label className="text-gray-100 mb-2">Search Customer</Label>
        <Input
          placeholder="Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#181c23] text-gray-100"
        />
        {/* Message if no customer records are found after filtering/searching */}
        {Object.values(customerMap)
          .filter(cust => cust.name.toLowerCase().includes(search.toLowerCase()))
          .length === 0 && <div className="text-gray-400 text-sm">No customer records found.</div>}

        {/* Render individual customer cards */}
        {Object.entries(customerMap)
          .filter(([_, cust]) => cust.name.toLowerCase().includes(search.toLowerCase()))
          .map(([customerId, cust]) => (
            <div key={customerId} className="mb-8 bg-[#23272f] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1 relative">
                <span className="font-bold text-gray-100 text-lg">{cust.name}</span>
                {/* Three-dot menu button */}
                <div>
                  <button
                    className="text-gray-400 p-1 hover:bg-gray-700 rounded"
                    onClick={() => setMenuAnchor(menuAnchor === customerId ? null : customerId)} // Toggle menu
                    aria-label="Open customer menu"
                  >
                    <ThreeDotIcon />
                  </button>
                  {/* Dropdown menu for Edit/Delete */}
                  {menuAnchor === customerId && (
                    <div
                      className="absolute right-0 mt-2 w-32 bg-white rounded shadow-lg z-10"
                      onMouseLeave={() => setMenuAnchor(null)} // Close menu on mouse leave
                    >
                      <button
                        className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                        onClick={() => handleEditCustomer(customerId)}
                      >
                        Edit
                      </button>
                      <button
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                        onClick={() => handleDeleteCustomer(customerId)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Render orders grouped by meal type for each customer */}
              {Object.entries(mealLabels).map(([mealKey, mealLabel]) => {
                const orders = cust.meals[mealKey] || [];
                if (!orders.length) return null; // Don't render if no orders for this meal

                return (
                  <div key={mealKey} className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-200 font-semibold">{mealLabel}:</span>
                      {/* Delete meal button with confirmation */}
                      <button
                        className="text-red-400 text-xs"
                        onClick={() => handleDeleteMeal(customerId, mealKey)}
                        title="Delete all orders for this meal"
                      >
                        (delete)
                      </button>
                    </div>
                    <table className="w-full mb-1" style={{ borderCollapse: "collapse" }}>
                      <tbody>
                        {/* Flatten orders to display individual items */}
                        {orders.flatMap(order =>
                          order.items.map((item, idx) => (
                            <tr key={order.orderId + "-" + idx} style={{ border: "none" }}>
                              <td
                                className="py-1 px-1 text-gray-100"
                                style={{ verticalAlign: "middle", width: "33%" }}
                              >
                                {item.name}
                              </td>
                              <td
                                className="py-1 px-1 text-gray-100 text-center"
                                style={{ verticalAlign: "middle", width: "33%" }}
                              >
                                {item.quantity}
                              </td>
                              <td
                                className="py-1 px-1 text-gray-100 text-right"
                                style={{ verticalAlign: "middle", width: "33%" }}
                              >
                                ₹{item.price * item.quantity}
                              </td>
                              {/* Button to remove a single item from an order */}
                              <td className="py-1 px-1" style={{ width: "auto" }}>
                                <button
                                  className="text-red-400"
                                  onClick={() => handleRemoveItem(customerId, order.orderId, idx)}
                                  title="Remove item"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
