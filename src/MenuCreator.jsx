// src/components/ui/app.jsx
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { format } from "date-fns";
import { database, auth } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";

export default function MenuCreator() {
  // NOTE: lunchDinner is the unified inventory for both lunch and dinner!
  const [inventory, setInventory] = useState({ breakfast: [], lunchDinner: {} });
  const [selected, setSelected] = useState({ breakfast: [], lunch: {}, dinner: {} });
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generatedMsg, setGeneratedMsg] = useState("");
  const [generatedTeluguMsg, setGeneratedTeluguMsg] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [currentTab, setCurrentTab] = useState("breakfast");
  const [editableInventory, setEditableInventory] = useState({ breakfast: [], lunchDinner: {} });
  const [user, setUser] = useState(null);

  const subcategories = ["daal", "curry", "pickle", "sambar", "others"];

  // Fetch inventory from Firebase
  useEffect(() => {
    const invRef = ref(database, "inventory");
    onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      // Ensure structure
      if (data) {
        if (!Array.isArray(data.breakfast)) data.breakfast = [];
        if (!data.lunchDinner) data.lunchDinner = {};
        setInventory(data);
      }
    });
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // For both lunch and dinner, use lunchDinner inventory
  const addItem = (meal, value) => {
    if (meal === "breakfast") {
      const item = inventory.breakfast.find(i => i.name === value);
      if (item && !selected.breakfast.some(i => i.name === value)) {
        setSelected(prev => ({
          ...prev,
          breakfast: [...prev.breakfast, item]
        }));
      }
    } else {
      const [sub, name] = value.split("::");
      const itemObj = inventory.lunchDinner?.[sub]?.find(i => i.name === name);
      if (itemObj && !(selected[meal]?.[sub] ?? []).some(i => i.name === name)) {
        setSelected(prev => ({
          ...prev,
          [meal]: {
            ...prev[meal],
            [sub]: [...(prev[meal]?.[sub] ?? []), itemObj]
          }
        }));
      }
    }
  };

  const removeItem = (meal, sub, name) => {
    if (meal === "breakfast") {
      setSelected(prev => ({
        ...prev,
        breakfast: prev.breakfast.filter(i => i.name !== name)
      }));
    } else {
      setSelected(prev => ({
        ...prev,
        [meal]: {
          ...prev[meal],
          [sub]: prev[meal][sub].filter(i => i.name !== name)
        }
      }));
    }
  };

  // Inventory editing helpers
  const updateNestedItem = (tab, sub, index, field, value) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast") {
      copy.breakfast[index][field] = value;
    } else {
      copy.lunchDinner[sub][index][field] = value;
    }
    setEditableInventory(copy);
  };

  const addNestedItem = (tab, sub) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast") {
      copy.breakfast.push({ name: "", telugu: "" });
    } else {
      if (!copy.lunchDinner[sub]) copy.lunchDinner[sub] = [];
      copy.lunchDinner[sub].push({ name: "", telugu: "" });
    }
    setEditableInventory(copy);
  };

  const deleteNestedItem = (tab, sub, index) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast") {
      copy.breakfast.splice(index, 1);
    } else {
      copy.lunchDinner[sub].splice(index, 1);
    }
    setEditableInventory(copy);
  };

  // Message generation logic (unchanged, but uses lunchDinner)
  const generateMessage = () => {
    const deliveryDay = format(new Date(deliveryDate), "dd/MMMM/yyyy");
    const to12Hour = (time24) => {
      const [hour, minute] = time24.split(":");
      const date = new Date();
      date.setHours(parseInt(hour), parseInt(minute));
      return format(date, "hh:mm a");
    };
    const formatEnglishSection = (emoji, title, items, deadline, dateLabel) => {
      const lines = Object.entries(items)
        .map(([sub, arr]) =>
          arr.map(i =>
            `- ${i.name}${i.price ? ` - ₹${i.price}` : ""}`
          ).join("\n")
        ).join("\n") || "- No items selected";
      return `\n${emoji} *${title}*\n${lines}\n\n🕒 *Order by:*\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━`;
    };
    const formatTeluguSection = (emoji, title, items, deadline, dateLabel) => {
      const lines = Object.entries(items)
        .map(([sub, arr]) =>
          arr.map(i =>
            `- ${i.telugu || i.name}${i.price ? ` - ₹${i.price}` : ""}`
          ).join("\n")
        ).join("\n") || "- ఎంపిక చేయలేదు";
      return `\n${emoji} ${title}\n${lines}\n\n🕒 *ఆర్డర్ గడువు:*\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━\n`;
    };
    const englishMsg =
      `🍽️ *Maa Inti Vanta - just for you*\n\n` +
      `Please select the items you'd like to receive.\n📅 *Delivery Date:*\n ${deliveryDay}` +
      formatEnglishSection("🌞", "Breakfast", { breakfast: selected.breakfast }, "10:00 PM", format(new Date(new Date(deliveryDate).setDate(new Date(deliveryDate).getDate() - 1)), "dd/MMMM/yyyy")) +
      formatEnglishSection("🍚", "Lunch", selected.lunch, "08:00 AM", deliveryDay) +
      formatEnglishSection("🌙", "Dinner", selected.dinner, "03:00 PM", deliveryDay) +
      `\n\n🚚 *Delivery Timings:*\n🌞Breakfast: 07:30 - 08:30 AM\n🍚Lunch: 12:30 - 01:30 PM\n🌙Dinner: 08:00 - 09:00 PM\n\n` +
      `📦 *Delivery Charges:*\nWithin 3 Km – ₹30\n3 Km to 6 Km – ₹60\n\nThank you!`;
    const teluguMsg =
      `🍲 మీ కోసం – *మా ఇంటి వంట!*\n\n` +
      `దయచేసి మీకు కావాల్సిన వంటలు ఎంచుకోండి.\n\n📅 *డెలివరీ తేదీ:*\n *${deliveryDay}*\n` +
      formatTeluguSection("🌞", "*టిఫిన్*", { breakfast: selected.breakfast }, "10:00 PM", format(new Date(new Date(deliveryDate).setDate(new Date(deliveryDate).getDate() - 1)), "dd/MMMM/yyyy")) +
      formatTeluguSection("🍚", "*మధ్యాహ్న భోజనం*", selected.lunch, "08:00AM", deliveryDay) +
      formatTeluguSection("🌙", "*రాత్రి భోజనం*", selected.dinner, "03:00PM", deliveryDay) +
      `\n\n🚚 *డెలివరీ సమయం*:\n🌞టిఫిన్: 08:30 - 09:30 AM\n🍚మధ్యాహ్న భోజనం: 12:30 - 01:30 PM\n🌙రాత్రి భోజనం: 08:00 - 09:00 PM\n\n` +
      `*డెలివరి ఛార్జ్ (3 Km లోపు): ₹30 రూపాయలు*.\n*డెలివరి ఛార్జ్ (3 Km - 6 Km): ₹60 రూపాయలు*\n\n` +
      `ధన్యవాదాలు`;
    setGeneratedMsg(englishMsg);
    setGeneratedTeluguMsg(teluguMsg);
  };

  const saveToFirebase = async () => {
    if (!auth.currentUser) {
      alert("❌ Please login to save changes.");
      return;
    }
    const copy = { ...editableInventory };
    if (!Array.isArray(copy.breakfast)) copy.breakfast = [];
    if (!copy.lunchDinner) copy.lunchDinner = {};
    const invRef = ref(database, "inventory");
    await set(invRef, copy);
    setInventory(copy);
    setShowEditor(false);
  };

  if (!user) return <Login />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Menu Creation</h1>
        <Button variant="outline" onClick={() => signOut(auth)}>Logout</Button>
      </div>
      <div>
        <Label>Delivery Date</Label>
        <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Breakfast */}
        <Card className="bg-gray-800 border border-gray-700 text-gray-100">
          <CardContent className="space-y-2 p-4">
            <h2 className="text-xl font-semibold capitalize">Breakfast</h2>
            <Label>Select Items</Label>
            <select
              className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2"
              onChange={e => addItem("breakfast", e.target.value)}
              value=""
            >
              <option disabled value="">-- select item --</option>
              {(inventory.breakfast ?? []).map(item => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2 mt-2">
              {(selected.breakfast ?? []).map(item => (
                <span
                  key={item.name}
                  className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-500"
                  onClick={() => removeItem("breakfast", "", item.name)}
                >
                  {item.name} ×
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lunch */}
        <Card className="bg-gray-800 border border-gray-700 text-gray-100">
          <CardContent className="space-y-2 p-4">
            <h2 className="text-xl font-semibold capitalize">Lunch</h2>
            {subcategories.map(sub => (
              <div key={sub}>
                <Label>Select {sub.charAt(0).toUpperCase() + sub.slice(1)}</Label>
                <select
                  className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2"
                  onChange={e => addItem("lunch", e.target.value)}
                  value=""
                >
                  <option disabled value="">-- select item --</option>
                  {(inventory.lunchDinner?.[sub] ?? []).map(item => (
                    <option key={item.name} value={`${sub}::${item.name}`}>{item.name}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(selected.lunch?.[sub] ?? []).map(item => (
                    <span
                      key={item.name}
                      className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-500"
                      onClick={() => removeItem("lunch", sub, item.name)}
                    >
                      {item.name} ×
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Dinner */}
        <Card className="bg-gray-800 border border-gray-700 text-gray-100">
          <CardContent className="space-y-2 p-4">
            <h2 className="text-xl font-semibold capitalize">Dinner</h2>
            {subcategories.map(sub => (
              <div key={sub}>
                <Label>Select {sub.charAt(0).toUpperCase() + sub.slice(1)}</Label>
                <select
                  className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2"
                  onChange={e => addItem("dinner", e.target.value)}
                  value=""
                >
                  <option disabled value="">-- select item --</option>
                  {(inventory.lunchDinner?.[sub] ?? []).map(item => (
                    <option key={item.name} value={`${sub}::${item.name}`}>{item.name}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(selected.dinner?.[sub] ?? []).map(item => (
                    <span
                      key={item.name}
                      className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-500"
                      onClick={() => removeItem("dinner", sub, item.name)}
                    >
                      {item.name} ×
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Generate & Edit Buttons */}
      <Button onClick={generateMessage}>Generate Message</Button>
      <Button variant="outline" onClick={() => {
        const copy = JSON.parse(JSON.stringify(inventory));
        if (!Array.isArray(copy.breakfast)) copy.breakfast = [];
        if (!copy.lunchDinner) copy.lunchDinner = {};
        setEditableInventory(copy);
        setShowEditor(true);
      }}>Edit Inventory</Button>

      {/* Generated Messages */}
      {generatedMsg && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>English</Label>
            <Textarea value={generatedMsg} rows={16} readOnly />
            <Button className="mt-2" onClick={() => copyToClipboard(generatedMsg)}>
              📋 Copy English
            </Button>
          </div>
          <div>
            <Label>Telugu</Label>
            <Textarea value={generatedTeluguMsg} rows={16} readOnly />
            <Button className="mt-2" onClick={() => copyToClipboard(generatedTeluguMsg)}>
              📋 Copy Telugu
            </Button>
          </div>
        </div>
      )}

      {/* Edit Inventory Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent>
          <h2 className="text-xl font-bold mb-4">Edit Inventory</h2>
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList>
              <TabsTrigger value="breakfast">Breakfast</TabsTrigger>
              <TabsTrigger value="lunchDinner">Lunch & Dinner</TabsTrigger>
            </TabsList>
            {/* Breakfast Tab */}
            <TabsContent value="breakfast">
              <div className="space-y-2">
                {(editableInventory.breakfast ?? []).map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={e => updateNestedItem("breakfast", "", idx, "name", e.target.value)}
                      placeholder="English"
                    />
                    <Input
                      value={item.telugu}
                      onChange={e => updateNestedItem("breakfast", "", idx, "telugu", e.target.value)}
                      placeholder="తెలుగు"
                    />
                    <Input
                      value={item.price}
                      onChange={e => updateNestedItem("breakfast", "", idx, "price", e.target.value)}
                      placeholder="₹"
                    />
                    <Button variant="destructive" onClick={() => deleteNestedItem("breakfast", "", idx)}>❌</Button>
                  </div>
                ))}
                <Button onClick={() => addNestedItem("breakfast", "")}>➕ Add Item</Button>
              </div>
            </TabsContent>
            {/* Lunch & Dinner Tab */}
            <TabsContent value="lunchDinner">
              {subcategories.map(sub => (
                <div key={sub} className="space-y-2">
                  <h3 className="text-md font-semibold capitalize">{sub}</h3>
                  {(editableInventory.lunchDinner?.[sub] ?? []).map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={item.name}
                        onChange={e => updateNestedItem("lunchDinner", sub, idx, "name", e.target.value)}
                        placeholder="English"
                      />
                      <Input
                        value={item.telugu}
                        onChange={e => updateNestedItem("lunchDinner", sub, idx, "telugu", e.target.value)}
                        placeholder="తెలుగు"
                      />
                      <Input
                        value={item.price}
                        onChange={e => updateNestedItem("lunchDinner", sub, idx, "price", e.target.value)}
                        placeholder="₹"
                      />
                      <Button variant="destructive" onClick={() => deleteNestedItem("lunchDinner", sub, idx)}>❌</Button>
                    </div>
                  ))}
                  <Button onClick={() => addNestedItem("lunchDinner", sub)}>➕ Add Item</Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
          <Button className="mt-4" onClick={saveToFirebase}>💾 Save</Button>
          <Button variant="outline" className="mt-2" onClick={() => setShowEditor(false)}>❌ Cancel</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
