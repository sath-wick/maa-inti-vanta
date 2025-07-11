import React, { useState, useEffect, useRef } from "react";
import { database } from "./firebase";
import { ref, onValue, push } from "firebase/database";
import html2canvas from "html2canvas-pro";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { format } from "date-fns";

// Persistent state hook using localStorage
function usePersistentState(key, initialValue) {
  const [state, setState] = React.useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  React.useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

// Copy-to-clipboard button
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button
      className="ml-2 px-3 py-1 rounded bg-blue-800 text-white text-xs"
      onClick={handleCopy}
      type="button"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// Helper: alphabetically sort items by name
function sortItems(items) {
  return [...(items || [])].sort((a, b) => a.name.localeCompare(b.name));
}

// CategorySelector for dropdown + qty + add
function CategorySelector({ categoryKey, label, items, onAdd }) {
  const [selectedName, setSelectedName] = useState("");
  const [qty, setQty] = useState(1);

  const sortedItems = sortItems(items);

  return (
    <div className="mb-4">
      <Label className="text-white">{label}</Label>
      <select
        className="w-full p-3 rounded bg-[#23272f] text-white text-base mt-1"
        value={selectedName}
        onChange={e => setSelectedName(e.target.value)}
      >
        <option value="">-- Select --</option>
        {sortedItems.map(i => (
          <option key={i.name} value={i.name}>{i.name} (₹{i.price})</option>
        ))}
      </select>
      <div className="flex gap-2 mt-2 items-center">
        <Label className="text-white">Qty</Label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={e => setQty(Number(e.target.value))}
          className="w-16 p-2 rounded bg-[#23272f] text-white"
        />
        <Button
          className="bg-green-700 text-white px-3 py-1"
          onClick={() => {
            if (selectedName && qty > 0) {
              onAdd(categoryKey, selectedName, qty);
              setSelectedName("");
              setQty(1);
            }
          }}
          disabled={!selectedName || qty <= 0}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export default function BillingModule() {
  // Persistent dashboards
  const [cookingSession, setCookingSession] = usePersistentState("cookingDashboard", {});
  const [packagingSession, setPackagingSession] = usePersistentState("packagingDashboard", {});

  const initialDeliveryCharge = 30;
  const initialOrderDate = format(new Date(), "yyyy-MM-dd");

  const [customers, setCustomers] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [inventory, setInventory] = useState({
    breakfast: [],
    curry: [],
    daal: [],
    pickle: [],
    sambar: [],
    others: []
  });
  const [orderDate, setOrderDate] = useState(initialOrderDate);
  const [deliveryCharge, setDeliveryCharge] = useState(initialDeliveryCharge);

  // Meal/category/item selection
  const [mealType, setMealType] = useState(""); // breakfast | lunch | dinner
  const lunchDinnerCategories = [
    { key: "daal", label: "Daal" },
    { key: "curry", label: "Curry" },
    { key: "pickle", label: "Pickle" },
    { key: "sambar", label: "Sambar" },
    { key: "others", label: "Others" }
  ];
  const [selectedItems, setSelectedItems] = useState([]); // [{category, name, quantity, price}]

  // Real-time customer order history for selected date
  const [customerOrders, setCustomerOrders] = useState([]);

  const billRef = useRef(null);

  // Load customers and inventory from Firebase
  useEffect(() => {
    onValue(ref(database, "customers"), snap => {
      const data = snap.val() || {};
      setCustomers(Object.entries(data).map(([id, v]) => ({ id, ...v })));
    });
    onValue(ref(database, "inventory"), snap => {
      const data = snap.val() || {};
      setInventory({
        breakfast: data.breakfast || [],
        curry: (data.lunchDinner && data.lunchDinner.curry) || [],
        daal: (data.lunchDinner && data.lunchDinner.daal) || [],
        pickle: (data.lunchDinner && data.lunchDinner.pickle) || [],
        sambar: (data.lunchDinner && data.lunchDinner.sambar) || [],
        others: (data.lunchDinner && data.lunchDinner.others) || []
      });
    });
  }, []);

  // Fetch real-time order history for selected customer and date
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([]);
      return;
    }
    const ordersRef = ref(database, `customerOrderHistory/${selectedCustomer.id}/orders`);
    const unsub = onValue(ordersRef, snap => {
      const data = snap.val() || {};
      const orders = Object.values(data);
      setCustomerOrders(
        orderDate
          ? orders.filter(o => o.date === orderDate)
          : orders
      );
    });
    return () => unsub();
  }, [selectedCustomer, orderDate]);

  // Customer creation
  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) return alert("Enter name and phone");
    const newRef = push(ref(database, "customers"), newCustomer);
    setShowCreateCustomer(false);
    setNewCustomer({ name: "", phone: "" });
    setSelectedCustomer({ ...newCustomer, id: newRef.key });
  };

  // Customer change with confirmation
  const handleCustomerChange = (id) => {
    if (selectedCustomer && selectedCustomer.id !== id) {
      if (!window.confirm("Switching customer will clear the current billing. Continue?")) return;
      setSelectedItems([]);
      setDeliveryCharge(initialDeliveryCharge);
      setOrderDate(initialOrderDate);
      setMealType("");
    }
    setSelectedCustomer(customers.find(c => c.id === id));
  };

  // Helper to get price for item
  const getItemPrice = (cat, name) => {
    const arr = inventory[cat] || [];
    const item = arr.find(i => i.name === name);
    return item?.price ? Number(item.price) : 0;
  };

  // Add or update item in selectedItems
  const addOrUpdateItem = (category, name, quantity) => {
    if (!name || quantity <= 0) return;
    setSelectedItems(items => {
      const existingIndex = items.findIndex(i => i.category === category && i.name === name);
      if (existingIndex >= 0) {
        const updated = [...items];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...items, { category, name, quantity, price: getItemPrice(category, name) }];
    });
  };

  // Remove item from bill
  const removeSelectedItem = (index) => {
    setSelectedItems(items => items.filter((_, i) => i !== index));
  };

  // Billing calculations
  const totalItemPrice = selectedItems.reduce((sum, row) => sum + row.price * row.quantity, 0);
  const grandTotal = totalItemPrice + Number(deliveryCharge);

  // Confirm order: update session dashboards and DB, then clear selections
  const handleConfirmOrder = async () => {
    if (!selectedCustomer) return alert("Select a customer");
    if (selectedItems.length === 0) return alert("Add at least one item with quantity > 0");

    // Store in DB
    const orderData = {
      date: orderDate,
      items: selectedItems.map(row => ({
        name: row.name,
        quantity: row.quantity,
        price: row.price
      })),
      deliveryCharges: deliveryCharge,
      grandTotal,
      customerName: selectedCustomer.name
    };
    await push(ref(database, `customerOrderHistory/${selectedCustomer.id}/orders`), orderData);

    // Update cooking session
    const newCooking = { ...cookingSession };
    selectedItems.forEach(item => {
      newCooking[item.name] = (newCooking[item.name] || 0) + item.quantity;
    });
    setCookingSession(newCooking);

    // Update packaging session
    const newPackaging = { ...packagingSession };
    if (!newPackaging[selectedCustomer.name]) newPackaging[selectedCustomer.name] = {};
    selectedItems.forEach(item => {
      newPackaging[selectedCustomer.name][item.name] =
        (newPackaging[selectedCustomer.name][item.name] || 0) + item.quantity;
    });
    setPackagingSession(newPackaging);

    // Download bill image (not displayed in UI)
    if (billRef.current) {
      const canvas = await html2canvas(billRef.current);
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `bill_${selectedCustomer.name || "customer"}.png`;
      link.click();
    }

    setSelectedItems([]);
    setDeliveryCharge(initialDeliveryCharge);
    setOrderDate(initialOrderDate);
    setMealType("");
  };

  // Clear all selections (for new order)
  const handleClearList = () => {
    setSelectedItems([]);
    setDeliveryCharge(initialDeliveryCharge);
    setOrderDate(initialOrderDate);
    setMealType("");
  };

  // Clear dashboards (for new meal session)
  const handleClearDashboards = () => {
    setCookingSession({});
    setPackagingSession({});
  };

  // Cooking dashboard textarea content
  const cookingText = Object.entries(cookingSession)
    .map(([item, qty]) => `${item}: ${qty}`)
    .join("\n");

  // Packaging dashboard textarea content
  const packagingText = Object.entries(packagingSession)
    .map(([customer, items]) =>
      `${customer}:\n` +
      Object.entries(items).map(([item, qty]) => `  ${item} x${qty}`).join("\n")
    ).join("\n\n");

  // Customer order history textarea content
  const customerHistoryText =
    customerOrders.length === 0
      ? "No orders for this date."
      : customerOrders.map(order =>
          order.items.map(item =>
            `${item.name} - ${item.quantity} - ₹${item.price * item.quantity}`
          ).join("\n") +
          `\nDelivery: ₹${order.deliveryCharges || 0}\nTotal: ₹${order.grandTotal || 0}\n`
        ).join("\n---\n");

  // Filter customers for search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.phone?.includes(searchCustomer)
  );

  return (
    <div className="w-full max-w-xs mx-auto p-4 space-y-4 bg-[#181c23] rounded-lg">
      {/* Create button at the top, small width */}
      <div className="flex justify-end mb-2">
        <Button
          className="px-4 py-2 text-sm bg-green-700 text-white rounded"
          style={{ minWidth: 80, maxWidth: 100 }}
          onClick={() => setShowCreateCustomer(true)}
        >
          Create
        </Button>
      </div>
      <h2 className="text-xl font-bold mb-4 text-white text-center">Billing Module</h2>
      <div className="flex flex-col gap-2 bg-[#23272f] rounded-lg p-4">
        <Label className="text-white">Customer</Label>
        <Input
          placeholder="Search customer"
          value={searchCustomer}
          onChange={e => setSearchCustomer(e.target.value)}
          className="w-full mb-2 p-3 rounded bg-[#23272f] text-white text-base"
        />
        <select
          className="w-full p-3 rounded bg-[#23272f] text-white text-base"
          value={selectedCustomer?.id || ""}
          onChange={e => handleCustomerChange(e.target.value)}
        >
          <option value="">-- Select Customer --</option>
          {filteredCustomers.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-white">Date</Label>
        <Input
          type="date"
          value={orderDate}
          onChange={e => setOrderDate(e.target.value)}
          className="w-full p-3 rounded bg-[#23272f] text-white text-base"
        />
      </div>
      {showCreateCustomer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="bg-[#23272f] rounded-lg p-4 w-full max-w-xs">
            <h3 className="font-bold mb-2 text-white">Create Customer</h3>
            <input placeholder="Name" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} className="w-full mb-2 p-2 border rounded bg-[#181c23] text-white" />
            <input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="w-full mb-2 p-2 border rounded bg-[#181c23] text-white" />
            <div className="flex gap-2">
              <Button className="w-full py-2 mb-2 bg-green-700 text-white" onClick={handleCreateCustomer}>Create & Select</Button>
              <Button className="w-full py-2 bg-gray-700 text-white" onClick={() => setShowCreateCustomer(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Meal/category/item selection */}
      {selectedCustomer && (
      <>
      <div className="mb-4">
        <Label className="text-white">Select Meal</Label>
        <select
          className="w-full p-3 rounded bg-[#23272f] text-white text-base mt-1"
          value={mealType}
          onChange={e => {
            setMealType(e.target.value);
            setSelectedItems([]);
          }}
        >
          <option value="">-- Select --</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
        </select>
      </div>

      {/* Breakfast items */}
      {mealType === "breakfast" && (
        <CategorySelector
          categoryKey="breakfast"
          label="Breakfast Items"
          items={inventory.breakfast || []}
          onAdd={addOrUpdateItem}
        />
      )}

      {/* Lunch/Dinner categories all shown */}
      {(mealType === "lunch" || mealType === "dinner") && (
        <>
          <CategorySelector categoryKey="daal" label="Daal" items={inventory.daal || []} onAdd={addOrUpdateItem} />
          <CategorySelector categoryKey="curry" label="Curry" items={inventory.curry || []} onAdd={addOrUpdateItem} />
          <CategorySelector categoryKey="pickle" label="Pickle" items={inventory.pickle || []} onAdd={addOrUpdateItem} />
          <CategorySelector categoryKey="sambar" label="Sambar" items={inventory.sambar || []} onAdd={addOrUpdateItem} />
          <CategorySelector categoryKey="others" label="Others" items={inventory.others || []} onAdd={addOrUpdateItem} />
        </>
      )}

      {/* Delivery Charges Radio Buttons */}
      <div className="flex flex-col gap-2 mt-6 bg-[#181c23] rounded-lg p-4">
        <Label className="text-white">Delivery Charges</Label>
        <div className="flex flex-col gap-2 mt-2">
          <label className="flex items-center gap-2 text-white">
            <input
              type="radio"
              name="delivery"
              value={0}
              checked={deliveryCharge === 0}
              onChange={() => setDeliveryCharge(0)}
            />
            No delivery
          </label>
          <label className="flex items-center gap-2 text-white">
            <input
              type="radio"
              name="delivery"
              value={30}
              checked={deliveryCharge === 30}
              onChange={() => setDeliveryCharge(30)}
            />
            Within 3km (+₹30)
          </label>
          <label className="flex items-center gap-2 text-white">
            <input
              type="radio"
              name="delivery"
              value={60}
              checked={deliveryCharge === 60}
              onChange={() => setDeliveryCharge(60)}
            />
            Beyond 3km (+₹60)
          </label>
        </div>
        <div className="text-right space-y-1 text-white mt-2">
          <div>Total Item Price: <b>₹{totalItemPrice}</b></div>
          <div>Delivery Charges: <b>₹{deliveryCharge}</b></div>
          <div className="text-lg">Grand Total: <b>₹{grandTotal}</b></div>
        </div>
      </div>
      </>)}

      {/* Show current items to be billed */}
      {selectedItems.length > 0 && (
        <div className="mb-4 bg-[#23272f] rounded-lg p-3">
          <Label className="text-white mb-2">Current Bill Items</Label>
          {selectedItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-white py-1">
              <span>{item.name} ({item.category}) x{item.quantity} - ₹{item.price * item.quantity}</span>
              <button
                className="text-red-400 px-2"
                onClick={() => removeSelectedItem(idx)}
                title="Remove"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Bill preview and controls */}
      {selectedCustomer && (
        <div className="mt-4">
          <div
            ref={billRef}
            className="bg-white text-black rounded-lg shadow-lg p-4 max-w-xs mx-auto border font-mono text-xs"
            style={{ minWidth: 280, fontFamily: "monospace", position: "relative", overflow: "hidden" }}
          >
            <div className="flex flex-col items-center mb-2">
              <span className="text-xl font-bold tracking-widest">Maa Inti Vanta</span>
              <span className="text-xs">Ph: 9346604522</span>
            </div>
            <hr className="my-2 border-gray-600" />
            <div className="flex justify-between text-xs mb-2">
              <span>Date: <b>{orderDate}</b></span>
              <span>Bill No: <b>{String(Date.now()).slice(-6)}</b></span>
            </div>
            <div className="mb-2 text-xs">
              Customer: <b>{selectedCustomer?.name}</b>
            </div>
            <table className="w-full text-xs border-t border-b border-gray-600 my-2">
              <thead>
                <tr className="text-left">
                  <th className="py-1 px-2">Item</th>
                  <th className="py-1 px-2 text-center">Qty</th>
                  <th className="py-1 px-2 text-right">Rate</th>
                  <th className="py-1 px-2 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((row, idx) => (
                  <tr key={row.category + row.name}>
                    <td className="py-1 px-2">{row.name}</td>
                    <td className="py-1 px-2 text-center">{row.quantity}</td>
                    <td className="py-1 px-2 text-right">₹{row.price}</td>
                    <td className="py-1 px-2 text-right">₹{row.price * row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between text-xs mt-2">
              <span>Subtotal</span>
              <span>₹{totalItemPrice}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Delivery</span>
              <span>₹{deliveryCharge}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-600 mt-2 pt-2">
              <span>Grand Total</span>
              <span>₹{grandTotal}</span>
            </div>
            <div className="text-center text-xs mt-4 italic">Thank you for dining with us!</div>
            <div className="absolute bottom-2 right-4 text-[10px] text-gray-400">Powered by Maa Inti Vanta</div>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              className="w-full py-4 text-lg font-bold bg-green-700 text-white rounded-lg"
              onClick={handleConfirmOrder}
            >
              Confirm Order
            </Button>
            <Button
              className="w-full py-4 text-lg font-bold bg-blue-700 text-white rounded-lg"
              onClick={handleClearList}
            >
              Clear List
            </Button>
          </div>
        </div>
      )}

      {/* Always-visible Cumulative Cooking & Packaging Dashboards */}
      <div className="grid grid-cols-1 gap-4 mt-8">
        <div className="bg-[#23272f] rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Label className="text-white flex-1">Cooking Dashboard (Session)</Label>
            <CopyButton text={cookingText} />
          </div>
          <Textarea value={cookingText} rows={6} readOnly className="bg-[#181c23] text-white" />
        </div>
        <div className="bg-[#23272f] rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Label className="text-white flex-1">Packaging Dashboard (Session)</Label>
            <CopyButton text={packagingText} />
          </div>
          <Textarea value={packagingText} rows={6} readOnly className="bg-[#181c23] text-white" />
        </div>
        <Button
          className="w-full py-2 text-base font-bold bg-red-700 text-white rounded-lg mt-2"
          onClick={handleClearDashboards}
        >
          Clear Dashboards (New Meal Session)
        </Button>
      </div>

      {/* Real-time Customer Order History for selected date */}
      {selectedCustomer && (
        <div className="bg-[#23272f] rounded-lg p-4 mt-8">
          <div className="flex items-center mb-2">
            <Label className="text-white flex-1">Order History (for selected date)</Label>
            <CopyButton text={customerHistoryText} />
          </div>
          <Textarea
            value={customerHistoryText}
            rows={6}
            readOnly
            className="bg-[#181c23] text-white"
          />
        </div>
      )}
    </div>
  );
}
