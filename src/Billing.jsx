import React, { useState, useEffect, useRef } from "react";
import { database } from "./firebase";
import { ref, onValue, push } from "firebase/database";
import html2canvas from "html2canvas-pro";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { format } from "date-fns";

export default function BillingModule() {
  const [customers, setCustomers] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderDate, setOrderDate] = useState("");
  const [mealType, setMealType] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState(30);
  const [customDeliveryCharge, setCustomDeliveryCharge] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [customItemEnglish, setCustomItemEnglish] = useState("");
  const [customItemTelugu, setCustomItemTelugu] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const billRef = useRef(null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [mealOptions, setMealOptions] = useState([
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
    { value: "bakery", label: "Bakery" },
  ]);

  useEffect(() => {
    const unsub = onValue(ref(database, "customers"), (snap) => {
      const data = snap.val() || {};
      setCustomers(Object.entries(data).map(([id, v]) => ({ id, ...v })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!orderDate) {
      setMenuItems([]);
      setMealOptions([
        { value: "breakfast", label: "Breakfast" },
        { value: "lunch", label: "Lunch" },
        { value: "dinner", label: "Dinner" },
        { value: "bakery", label: "Bakery" },
      ]);
      setMealType("");
      return;
    }
    setMenuLoading(true);
    setMenuError("");
    const menusRef = ref(database, `menus/${orderDate}`);
    onValue(menusRef, (snap) => {
      const data = snap.val() || {};
      let options = [
        { value: "breakfast", label: "Breakfast", items: data.breakfast || [] },
        { value: "lunch", label: "Lunch", items: data.lunch || [] },
        { value: "dinner", label: "Dinner", items: data.dinner || [] },
        { value: "bakery", label: "Bakery", items: data.bakery || [] },
      ];
      const standardKeys = ["breakfast", "lunch", "dinner", "bakery"];
      const customMenuKeys = Object.keys(data).filter(
        (key) => !standardKeys.includes(key) && Array.isArray(data[key]) && data[key].length > 0
      );
      customMenuKeys.forEach((key) => {
        options.push({ value: key, label: key.replace(/_/g, " ").toUpperCase(), items: data[key] });
      });
      setMealOptions(options);
      setMenuItems([]);
      setMealType("");
      setMenuLoading(false);
    });
  }, [orderDate]);

  useEffect(() => {
    if (!mealType || !orderDate) return;
    setMenuLoading(true);
    setMenuError("");
    const selectedMeal = mealOptions.find((m) => m.value === mealType);
    if (selectedMeal && selectedMeal.items) {
      setMenuItems(selectedMeal.items);
    } else {
      setMenuItems([]);
      setMenuError("⚠️ Menu not set for this date & meal.");
    }
    setMenuLoading(false);
  }, [mealType, orderDate, mealOptions]);

  const updateItemQuantity = (item, quantity) => {
    if (quantity <= 0) {
      removeItem(item.name);
    } else {
      setSelectedItems((prev) => {
        const exists = prev.find((i) => i.name === item.name);
        if (exists) {
          return prev.map((i) => (i.name === item.name ? { ...i, quantity } : i));
        }
        return [...prev, { ...item, quantity }];
      });
    }
  };

  const removeItem = (name) => {
    setSelectedItems((items) => items.filter((i) => i.name !== name));
  };

  const handleAddCustomItem = () => {
    if (!customItemEnglish || !customItemTelugu || !customItemPrice) {
      alert("Please enter English name, Telugu name, and price for custom item.");
      return;
    }
    const exists = selectedItems.find((i) => i.name === customItemEnglish);
    if (exists) {
      alert("Item already added.");
      return;
    }
    const newItem = {
      name: customItemEnglish,
      teluguName: customItemTelugu,
      price: Number(customItemPrice),
      quantity: 1,
      isCustom: true,
    };
    setSelectedItems((prev) => [...prev, newItem]);
    setCustomItemEnglish("");
    setCustomItemTelugu("");
    setCustomItemPrice("");
  };

  const handleDeliveryChange = (value) => {
    if (value === "custom") {
      setCustomDeliveryCharge("0");
      setDeliveryCharge(0);
    } else {
      setDeliveryCharge(Number(value));
      setCustomDeliveryCharge("");
    }
  };

  const handleCustomChargeChange = (e) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setCustomDeliveryCharge(val);
      setDeliveryCharge(val === "" ? 0 : Number(val));
    }
  };

  const totalItemPrice = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const grandTotal = totalItemPrice + deliveryCharge;

  const handleConfirmOrder = async () => {
    if (!orderDate || !mealType || !selectedCustomer) {
      alert("Select Date, Meal, and Customer.");
      return;
    }
    if (!selectedItems.length) {
      alert("Add at least one item.");
      return;
    }
    const orderData = {
    date: orderDate,
    mealType,
    deliveryCharges: deliveryCharge,
    customerName: selectedCustomer.name,
    grandTotal,
    items: selectedItems.map(({ name, price, quantity }) => ({
      name,
      price: String(price),  // keep price as string to match DB
      quantity,
    })),
  };

    await push(ref(database, `customerOrderHistory/${selectedCustomer.id}/orders`), orderData);
    if (billRef.current) {
      const canvas = await html2canvas(billRef.current);
      const file = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const fileName = `${format(new Date(orderDate), "ddMMyy")}_${mealType}_${selectedCustomer.name.replace(/\s+/g, "_")}.png`;
      link.href = file;
      link.download = fileName;
      link.click();
    }
    alert("Order saved!");
    setSelectedItems([]);
    setMealType("");
    setDeliveryCharge(30);
    setCustomDeliveryCharge("");
  };

  const handleClear = () => {
    setOrderDate("");
    setSelectedCustomer(null);
    setMealType("");
    setSelectedItems([]);
    setCustomItemEnglish("");
    setCustomItemTelugu("");
    setCustomItemPrice("");
    setDeliveryCharge(30);
    setCustomDeliveryCharge("");
  };

  return (
    <div className="w-full max-w-xs mx-auto p-4 space-y-6 bg-[#181c23] text-white rounded-lg">
      <div className="text-right">
        <Button onClick={() => setShowNewCustomerModal(true)} className="bg-blue-600 text-white">
          + New Customer
        </Button>
      </div>
      <div>
        <Label>Date</Label>
        <Input
          type="date"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
          className="bg-[#23272f] text-white"
        />
      </div>
      {orderDate && (
        <div className="space-y-2">
          <Label>Customer</Label>
          <Input
            placeholder="Search customer..."
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
            className="bg-[#23272f] text-white"
          />
          <select
            value={selectedCustomer?.id || ""}
            onChange={(e) => {
              setSelectedCustomer(customers.find((c) => c.id === e.target.value));
              setSelectedItems([]);
              setMealType("");
            }}
            className="w-full p-2 rounded bg-[#23272f] text-white"
          >
            <option value="">-- Select Customer --</option>
            {customers
              .filter(
                (c) =>
                  c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
                  c.phone?.includes(searchCustomer)
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
          </select>
        </div>
      )}
      {selectedCustomer && (
        <div className="mt-3">
          <Label>Meal</Label>
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            className="w-full p-2 rounded bg-[#23272f] text-white"
          >
            <option value="">-- Select Meal --</option>
            {mealOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {mealType && menuItems.length > 0 && (
        <div className="bg-[#23272f] p-3 rounded space-y-3">
          <Label>Items</Label>
          {menuItems.map((item) => {
            const selected = selectedItems.find((i) => i.name === item.name);
            return (
              <div key={item.name} className="flex items-center gap-2">
                <span className="flex-1">{item.name} (₹{item.price})</span>
                <Input
                  type="number"
                  className="w-14 bg-[#181c23] text-white"
                  value={selected?.quantity || ""}
                  onChange={(e) => updateItemQuantity(item, parseInt(e.target.value || 0))}
                />
                <Button onClick={() => removeItem(item.name)} className="bg-red-700">
                  ×
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {selectedCustomer && (
        <div className="bg-[#23272f] p-3 rounded space-y-2 flex flex-col">
          <Label>Add Custom Item</Label>
          <Input
            placeholder="Item name (English)"
            value={customItemEnglish}
            onChange={(e) => setCustomItemEnglish(e.target.value)}
            className="bg-[#181c23] text-white"
          />
          <Input
            placeholder="Item name (Telugu)"
            value={customItemTelugu}
            onChange={(e) => setCustomItemTelugu(e.target.value)}
            className="bg-[#181c23] text-white"
          />
          <Input
            placeholder="Price"
            type="number"
            value={customItemPrice}
            onChange={(e) => setCustomItemPrice(e.target.value)}
            className="bg-[#181c23] text-white"
          />
          <Button onClick={handleAddCustomItem}>Add Custom Item</Button>
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedItems
              .filter((i) => i.isCustom)
              .map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2 bg-blue-700 px-3 py-1 rounded-full"
                >
                  <span>
                    {item.name} ₹{item.price}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      className="px-2 py-0 bg-gray-800"
                      onClick={() => updateItemQuantity(item, item.quantity - 1)}
                    >
                      -
                    </Button>
                    <span>{item.quantity}</span>
                    <Button
                      className="px-2 py-0 bg-gray-800"
                      onClick={() => updateItemQuantity(item, item.quantity + 1)}
                    >
                      +
                    </Button>
                    <Button
                      className="px-2 py-0 bg-red-600"
                      onClick={() => removeItem(item.name)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      {selectedCustomer && (
        <div className="bg-[#23272f] p-3 rounded space-y-2">
          <Label>Delivery Charges</Label>
          <div className="space-y-1">
            <label>
              <input
                type="radio"
                name="delivery"
                value="0"
                checked={deliveryCharge === 0 && customDeliveryCharge === ""}
                onChange={() => handleDeliveryChange(0)}
              />{" "}
              No delivery
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="delivery"
                value="30"
                checked={deliveryCharge === 30 && customDeliveryCharge === ""}
                onChange={() => handleDeliveryChange(30)}
              />{" "}
              Within 3km (₹30)
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="delivery"
                value="60"
                checked={deliveryCharge === 60 && customDeliveryCharge === ""}
                onChange={() => handleDeliveryChange(60)}
              />{" "}
              Beyond 3km (₹60)
            </label>
            <br />
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="delivery"
                value="custom"
                checked={customDeliveryCharge !== ""}
                onChange={() => handleDeliveryChange("custom")}
              />
              Custom
              <Input
                type="number"
                min={0}
                value={customDeliveryCharge}
                onChange={handleCustomChargeChange}
                disabled={customDeliveryCharge === ""}
                className="w-20 bg-[#181c23] text-white ml-2"
                placeholder="₹"
              />
            </label>
          </div>
          <div className="pt-2">
            <div>Subtotal: ₹{totalItemPrice}</div>
            <div>Delivery: ₹{deliveryCharge}</div>
            <div className="font-bold">Grand Total: ₹{grandTotal}</div>
          </div>
        </div>
      )}
      {selectedCustomer && (
        <div className="space-y-2">
          <Button className="bg-green-700 w-full" onClick={handleConfirmOrder}>
            Confirm Order
          </Button>
          <Button className="bg-gray-700 w-full" onClick={handleClear}>
            Clear
          </Button>
        </div>
      )}
      {selectedCustomer && selectedItems.length > 0 && (
        <div
          ref={billRef}
          className="bg-white text-black p-4 rounded mt-4 font-mono text-sm shadow-lg"
        >
          {/* Header */}
          <div className="text-center border-b border-gray-400 pb-2 mb-2">
            <h2 className="text-xl font-bold">Maa Inti Vanta</h2>
            <p className="text-xs">NFC Nagar, Telangana</p>
            <p className="text-xs">Phone: +91 9346604522</p>
          </div>

          {/* Bill Metadata */}
          <div className="flex justify-between text-xs mb-2">
            <div>
              <p><b>Bill Date:</b> {orderDate}</p>
              <p><b>Customer:</b> {selectedCustomer.name}</p>
            </div>
            <div>
              <p><b>Bill No.:</b> #{Math.floor(Math.random() * 10000)}</p>
              <p><b>Meal Type:</b> {mealType}</p>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-5 border-b border-gray-400 py-1 font-bold text-xs">
            <div>S.No</div>
            <div className="col-span-2">Item</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Amount</div>
          </div>

          {/* Item Rows */}
          {selectedItems.map((i, idx) => (
            <div
              key={i.name}
              className="grid grid-cols-5 py-1 border-b border-dotted border-gray-300 text-xs"
            >
              <div>{idx + 1}</div>
              <div className="col-span-2">
                {i.name} {i.teluguName ? `(${i.teluguName})` : ""}
              </div>
              <div className="text-center">{i.quantity}</div>
              <div className="text-right">₹{i.price * i.quantity}</div>
            </div>
          ))}

          {/* Totals Section */}
          <div className="mt-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{totalItemPrice}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Charges:</span>
              <span>₹{deliveryCharge}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-400 mt-1 pt-1">
              <span>Grand Total:</span>
              <span>₹{grandTotal}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-4 text-xs border-t border-gray-400 pt-2">
            <p>Thank you for your order 🙏</p>
            <p>Order Again!</p>
          </div>
        </div>
        )}

    </div>
  );
}
