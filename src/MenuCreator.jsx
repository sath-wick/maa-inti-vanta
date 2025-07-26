import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { format } from "date-fns";
import { database, auth } from "./firebase";
import { ref, onValue, set, update } from "firebase/database";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";

// Alphabetical sort helper
function sortByName(arr) {
  return [...(arr || [])].sort((a, b) => a.name.localeCompare(b.name));
}

// Bakery items array
const bakeryItems = [
  { name: "Banana Muffin Without Frosting", telugu: "", price: 25 },
  { name: "Chocolate Muffin Without Frosting", telugu: "", price: 30 },
  { name: "Banana Muffin With Frosting", telugu: "", price: 35 },
  { name: "Pineapple Pastry", telugu: "", price: 40 },
  { name: "Chocolate Muffin With Frosting", telugu: "", price: 40 },
];

// Subcategories for lunch/dinner
const subcategories = ["daal", "curry", "pickle", "sambar", "others"];

// ----- SearchableDropdown Component -----
function SearchableDropdown({ items, onSelect, placeholder }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter items by query case-insensitive
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600"
        placeholder={placeholder}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {isOpen && (
        <ul className="absolute z-10 max-h-60 overflow-auto w-full rounded border border-gray-600 bg-gray-700 text-white text-sm mt-1">
          {filteredItems.length === 0 ? (
            <li className="p-2 cursor-default select-none">No items found</li>
          ) : (
            filteredItems.map((item) => (
              <li
                key={item.name}
                className="p-2 cursor-pointer hover:bg-gray-600"
                onClick={() => {
                  onSelect(item.name);
                  setQuery("");
                  setIsOpen(false);
                }}
              >
                {item.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ----- Main MenuCreator component -----
export default function MenuCreator() {
  const [inventory, setInventory] = useState({
    breakfast: [],
    lunchDinner: {},
    bakery: [],
  });

  const [selected, setSelected] = useState({
    breakfast: [],
    lunch: {},
    dinner: {},
    bakery: [],
  });

  const [deliveryDate, setDeliveryDate] = useState(""); // initially empty
  const [generatedMsg, setGeneratedMsg] = useState("");
  const [generatedTeluguMsg, setGeneratedTeluguMsg] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [currentTab, setCurrentTab] = useState("breakfast");
  const [editableInventory, setEditableInventory] = useState({
    breakfast: [],
    lunchDinner: {},
    bakery: [],
  });
  const [user, setUser] = useState(null);

  // Load inventory from Firebase
  useEffect(() => {
    const invRef = ref(database, "inventory");
    onValue(invRef, (snapshot) => {
      const data = snapshot.val() || {};
      if (!Array.isArray(data.breakfast)) data.breakfast = [];
      if (!data.lunchDinner) data.lunchDinner = {};
      if (!Array.isArray(data.bakery)) {
        data.bakery = bakeryItems; // Initialize bakery meal type if missing
      }
      setInventory(data);
    });
  }, []);

  // Auth listener
  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Clipboard helper
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Save editable inventory to Firebase
  const saveToFirebase = async () => {
    if (!auth.currentUser) {
      alert("❌ Please login to save changes.");
      return;
    }
    const copy = { ...editableInventory };
    if (!Array.isArray(copy.breakfast)) copy.breakfast = [];
    if (!copy.lunchDinner) copy.lunchDinner = {};
    if (!Array.isArray(copy.bakery)) copy.bakery = [];
    const invRef = ref(database, "inventory");
    await set(invRef, copy);
    setInventory(copy);
    setShowEditor(false);
  };

  // Add item handler
  const addItem = (meal, value) => {
    if (meal === "breakfast" || meal === "bakery") {
      const item = inventory[meal].find((i) => i.name === value);
      if (item && !selected[meal].some((i) => i.name === value)) {
        setSelected((prev) => ({
          ...prev,
          [meal]: [...prev[meal], item],
        }));
      }
    } else {
      const [sub, name] = value.split("::");
      const itemObj = inventory.lunchDinner?.[sub]?.find((i) => i.name === name);
      if (itemObj && !(selected[meal]?.[sub] ?? []).some((i) => i.name === name)) {
        setSelected((prev) => ({
          ...prev,
          [meal]: {
            ...prev[meal],
            [sub]: [...(prev[meal]?.[sub] ?? []), itemObj],
          },
        }));
      }
    }
  };

  // Remove item handler
  const removeItem = (meal, sub, name) => {
    if (meal === "breakfast" || meal === "bakery") {
      setSelected((prev) => ({
        ...prev,
        [meal]: prev[meal].filter((i) => i.name !== name),
      }));
    } else {
      setSelected((prev) => ({
        ...prev,
        [meal]: {
          ...prev[meal],
          [sub]: prev[meal][sub].filter((i) => i.name !== name),
        },
      }));
    }
  };

  // Update nested item inside editable inventory
  const updateNestedItem = (tab, sub, index, field, value) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast" || tab === "bakery") {
      copy[tab][index][field] = value;
    } else {
      copy.lunchDinner[sub][index][field] = value;
    }
    setEditableInventory(copy);
  };

  // Add nested item for editable inventory
  const addNestedItem = (tab, sub) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast" || tab === "bakery") {
      copy[tab].push({ name: "", telugu: "", price: 0 });
    } else {
      if (!copy.lunchDinner[sub]) copy.lunchDinner[sub] = [];
      copy.lunchDinner[sub].push({ name: "", telugu: "", price: 0 });
    }
    setEditableInventory(copy);
  };

  // Delete nested item for editable inventory
  const deleteNestedItem = (tab, sub, index) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast" || tab === "bakery") {
      copy[tab].splice(index, 1);
    } else {
      copy.lunchDinner[sub].splice(index, 1);
    }
    setEditableInventory(copy);
  };

  // Flatten lunch/dinner selections for message generation
  const flattenLunchDinner = (mealObj) =>
    subcategories.flatMap((sub) => mealObj[sub] || []);

  // Generate message and save menu to Firebase
  const generateMessageAndSaveMenu = async () => {
    const deliveryDay = format(new Date(deliveryDate), "dd/MMMM/yyyy");
    const formatEnglishSection = (emoji, title, items, deadline, dateLabel) => {
      const lines =
        Object.entries(items)
          .map(([sub, arr]) =>
            arr
              .map((i) => `- ${i.name}${i.price ? ` - ₹${i.price}` : ""}`)
              .join("\n")
          )
          .join("\n") || "- No items selected";
      return `\n${emoji} *${title}*\n${lines}\n\n🕒 *Order by:*\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━`;
    };
    const formatTeluguSection = (emoji, title, items, deadline, dateLabel) => {
      const lines =
        Object.entries(items)
          .map(([sub, arr]) =>
            arr
              .map((i) => `- ${i.telugu || i.name}${i.price ? ` - ₹${i.price}` : ""}`)
              .join("\n")
          )
          .join("\n") || "- ఎంపిక చేయలేదు";
      return `\n${emoji} ${title}\n${lines}\n\n🕒 *ఆర్డర్ గడువు:*\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━\n`;
    };
    const englishMsg =
      `🍽️ *Maa Inti Vanta - just for you*\n\n` +
      `Please select the items you'd like to receive.\n📅 *Delivery Date:*\n ${deliveryDay}` +
      formatEnglishSection("🌞", "Breakfast", { breakfast: selected.breakfast }, "06:00 AM", deliveryDay) +
      formatEnglishSection("🍰", "Bakery", { bakery: selected.bakery }, "06:00 AM", deliveryDay) +
      formatEnglishSection("🍚", "Lunch", selected.lunch, "09:00 AM", deliveryDay) +
      formatEnglishSection("🌙", "Dinner", selected.dinner, "05:00 PM", deliveryDay) +
      `\n\n🚚 *Delivery Timings:*\n🌞Breakfast: 07:30 - 08:30 AM\n🍰Bakery: 6:00 - 7:00 PM\n🍚Lunch: 12:30 - 01:30 PM\n🌙Dinner: 08:00 - 09:00 PM\n\n` +
      `📦 *Delivery Charges:*\nWithin 3 Km – ₹30\n3 Km to 6 Km – ₹60\n\nThank you!`;
    const teluguMsg =
      `🍲 మీ కోసం – *మా ఇంటి వంట!*\n\n` +
      `దయచేసి మీకు కావాల్సిన వంటలు ఎంచుకోండి.\n\n📅 *డెలివరీ తేదీ:*\n *${deliveryDay}*\n` +
      formatTeluguSection("🌞", "*టిఫిన్*", { breakfast: selected.breakfast }, "06:00 AM", deliveryDay) +
      formatTeluguSection("🍰", "*బేకరీ*", { bakery: selected.bakery }, "06:00AM", deliveryDay) +
      formatTeluguSection("🍚", "*మధ్యాహ్న భోజనం*", selected.lunch, "09:00AM", deliveryDay) +
      formatTeluguSection("🌙", "*రాత్రి భోజనం*", selected.dinner, "05:00PM", deliveryDay) +
      `\n\n🚚 *డెలివరీ సమయం*:\n🌞టిఫిన్: 07:30 - 08:30 AM\n🍰బేకరీ: 6:00 - 7:00 PM\n🍚మధ్యాహ్న భోజనం: 12:30 - 01:30 PM\n🌙రాత్రి భోజనం: 08:00 - 09:00 PM\n\n` +
      `*డెలివరి ఛార్జ్ (3 Km లోపు): ₹30 రూపాయలు*.\n*డెలివరి ఛార్జ్ (3 Km - 6 Km): ₹60 రూపాయలు*\n\n` +
      `ధన్యవాదాలు`;
    setGeneratedMsg(englishMsg);
    setGeneratedTeluguMsg(teluguMsg);

    if (!auth.currentUser) {
      alert("❌ Please login to save menu.");
      return;
    }
    const menuRef = ref(database, `menus/${deliveryDate}`);
    const menuData = {
      breakfast: selected.breakfast.map(({ name, price }) => ({ name, price })),
      bakery: selected.bakery.map(({ name, price }) => ({ name, price })),
      lunch: flattenLunchDinner(selected.lunch).map(({ name, price }) => ({ name, price })),
      dinner: flattenLunchDinner(selected.dinner).map(({ name, price }) => ({ name, price })),
    };
    await update(menuRef, menuData);
    setSelected({ breakfast: [], lunch: {}, dinner: {}, bakery: [] });
    alert("✅ Menu generated and saved for " + deliveryDate);
  };

  // Return login if not authenticated
  if (!user) return <Login />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Menu Creation</h1>
        <Button variant="outline" onClick={() => signOut(auth)}>Logout</Button>
      </div>

      <div>
        <Label>Delivery Date</Label>
        <Input
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
        />
      </div>

      {deliveryDate && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Breakfast */}
          <Card className="bg-gray-800 border border-gray-700 text-gray-100">
            <CardContent className="space-y-2 p-4">
              <h2 className="text-xl font-semibold capitalize">Breakfast</h2>
              <Label>Select Items</Label>
              <SearchableDropdown
                items={sortByName(inventory.breakfast ?? [])}
                placeholder="Select item..."
                onSelect={(itemName) => addItem("breakfast", itemName)}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {(selected.breakfast ?? []).map((item) => (
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
              {subcategories.map((sub) => (
                <div key={sub}>
                  <Label>
                    Select {sub.charAt(0).toUpperCase() + sub.slice(1)}
                  </Label>
                  <SearchableDropdown
                    items={sortByName(inventory.lunchDinner?.[sub] ?? [])}
                    placeholder="Select item..."
                    onSelect={(itemName) => addItem("lunch", `${sub}::${itemName}`)}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(selected.lunch?.[sub] ?? []).map((item) => (
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
              {subcategories.map((sub) => (
                <div key={sub}>
                  <Label>
                    Select {sub.charAt(0).toUpperCase() + sub.slice(1)}
                  </Label>
                  <SearchableDropdown
                    items={sortByName(inventory.lunchDinner?.[sub] ?? [])}
                    placeholder="Select item..."
                    onSelect={(itemName) => addItem("dinner", `${sub}::${itemName}`)}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(selected.dinner?.[sub] ?? []).map((item) => (
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

          {/* Bakery */}
          <Card className="bg-gray-800 border border-gray-700 text-gray-100">
            <CardContent className="space-y-2 p-4">
              <h2 className="text-xl font-semibold capitalize">Bakery</h2>
              <Label>Select Items</Label>
              <SearchableDropdown
                items={sortByName(inventory.bakery ?? [])}
                placeholder="Select item..."
                onSelect={(itemName) => addItem("bakery", itemName)}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {(selected.bakery ?? []).map((item) => (
                  <span
                    key={item.name}
                    className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-purple-500"
                    onClick={() => removeItem("bakery", "", item.name)}
                  >
                    {item.name} ×
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Button className="mt-4" onClick={generateMessageAndSaveMenu}>
        Generate Message & Save Menu
      </Button>

      <Button
        variant="outline"
        onClick={() => {
          const copy = JSON.parse(JSON.stringify(inventory));
          if (!Array.isArray(copy.breakfast)) copy.breakfast = [];
          if (!copy.lunchDinner) copy.lunchDinner = {};
          if (!Array.isArray(copy.bakery)) copy.bakery = [];
          setEditableInventory(copy);
          setShowEditor(true);
        }}
      >
        Edit Inventory
      </Button>

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

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent>
          <h2 className="text-xl font-bold mb-4">Edit Inventory</h2>
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList>
              <TabsTrigger value="breakfast">Breakfast</TabsTrigger>
              <TabsTrigger value="lunchDinner">Lunch & Dinner</TabsTrigger>
              <TabsTrigger value="bakery">Bakery</TabsTrigger>
            </TabsList>

            <TabsContent value="breakfast">
              <div className="space-y-2">
                {(editableInventory.breakfast ?? []).map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        updateNestedItem("breakfast", "", idx, "name", e.target.value)
                      }
                      placeholder="English"
                    />
                    <Input
                      value={item.telugu}
                      onChange={(e) =>
                        updateNestedItem("breakfast", "", idx, "telugu", e.target.value)
                      }
                      placeholder="తెలుగు"
                    />
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) =>
                        updateNestedItem("breakfast", "", idx, "price", e.target.value)
                      }
                      placeholder="₹"
                    />
                    <Button variant="destructive" onClick={() => deleteNestedItem("breakfast", "", idx)}>
                      ❌
                    </Button>
                  </div>
                ))}
                <Button onClick={() => addNestedItem("breakfast", "")}>➕ Add Item</Button>
              </div>
            </TabsContent>

            <TabsContent value="lunchDinner">
              {subcategories.map((sub) => (
                <div key={sub} className="space-y-2">
                  <h3 className="text-md font-semibold capitalize">{sub}</h3>
                  {(editableInventory.lunchDinner?.[sub] ?? []).map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={item.name}
                        onChange={(e) =>
                          updateNestedItem("lunchDinner", sub, idx, "name", e.target.value)
                        }
                        placeholder="English"
                      />
                      <Input
                        value={item.telugu}
                        onChange={(e) =>
                          updateNestedItem("lunchDinner", sub, idx, "telugu", e.target.value)
                        }
                        placeholder="తెలుగు"
                      />
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) =>
                          updateNestedItem("lunchDinner", sub, idx, "price", e.target.value)
                        }
                        placeholder="₹"
                      />
                      <Button variant="destructive" onClick={() => deleteNestedItem("lunchDinner", sub, idx)}>
                        ❌
                      </Button>
                    </div>
                  ))}
                  <Button onClick={() => addNestedItem("lunchDinner", sub)}>➕ Add Item</Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="bakery">
              <div className="space-y-2">
                {(editableInventory.bakery ?? []).map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        updateNestedItem("bakery", "", idx, "name", e.target.value)
                      }
                      placeholder="English"
                    />
                    <Input
                      value={item.telugu}
                      onChange={(e) =>
                        updateNestedItem("bakery", "", idx, "telugu", e.target.value)
                      }
                      placeholder="తెలుగు"
                    />
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) =>
                        updateNestedItem("bakery", "", idx, "price", e.target.value)
                      }
                      placeholder="₹"
                    />
                    <Button variant="destructive" onClick={() => deleteNestedItem("bakery", "", idx)}>
                      ❌
                    </Button>
                  </div>
                ))}
                <Button onClick={() => addNestedItem("bakery", "")}>➕ Add Item</Button>
              </div>
            </TabsContent>
          </Tabs>

          <Button className="mt-4" onClick={saveToFirebase}>
            💾 Save
          </Button>
          <Button variant="outline" className="mt-2" onClick={() => setShowEditor(false)}>
            ❌ Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
