import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { format } from "date-fns";
import { database, auth } from "./firebase";
import { ref, onValue, update, get, remove } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";

function sortByName(arr) {
  return [...(arr || [])].sort((a, b) => a.name.localeCompare(b.name));
}

const bakeryItems = [
  { name: "Banana Muffin Without Frosting", telugu: "", price: 25 },
  { name: "Chocolate Muffin Without Frosting", telugu: "", price: 30 },
  { name: "Banana Muffin With Frosting", telugu: "", price: 35 },
  { name: "Pineapple Pastry", telugu: "", price: 40 },
  { name: "Chocolate Muffin With Frosting", telugu: "", price: 40 },
];

const subcategories = ["daal", "curry", "pickle", "sambar", "others"];

function SearchableDropdown({ items, onSelect, placeholder }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

function getPrevMonthYYYYMM() {
  const now = new Date();
  now.setDate(1);
  now.setMonth(now.getMonth() - 1);
  return now.toISOString().slice(0, 7);
}

function isValidMenuDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  return y >= 2023 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

async function cleanupOldMenusIfFirst(database) {
  const today = new Date();
  if (today.getDate() !== 1) return;
  const monthKey = today.toISOString().slice(0, 7);
  const alreadyRun = localStorage.getItem("menuCleanupMonth") === monthKey;
  if (alreadyRun) return;
  const menuRef = ref(database, "menus");
  const snapshot = await get(menuRef);
  const prevMonth = getPrevMonthYYYYMM();

  snapshot.forEach(childSnap => {
    const menuKey = childSnap.key;
    if (!isValidMenuDate(menuKey) || menuKey.slice(0, 7) < prevMonth) {
      remove(ref(database, `menus/${menuKey}`));
    }
  });

  localStorage.setItem("menuCleanupMonth", monthKey);
}

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

  const [customMenu, setCustomMenu] = useState({
    title: "Custom Menu",
    teluguTitle: "",
    items: [],
  });

  const [deliveryDate, setDeliveryDate] = useState("");

  const [billTeluguMeals, setBillTeluguMeals] = useState("");
  const [billEnglishMeals, setBillEnglishMeals] = useState("");
  const [billBakery, setBillBakery] = useState("");
  const [billCustom, setBillCustom] = useState("");

  const [user, setUser] = useState(null);

  useEffect(() => {
    cleanupOldMenusIfFirst(database);
  }, []);

  useEffect(() => {
    const invRef = ref(database, "inventory");
    onValue(invRef, (snapshot) => {
      const data = snapshot.val() || {};
      if (!Array.isArray(data.breakfast)) data.breakfast = [];
      if (!data.lunchDinner) data.lunchDinner = {};
      if (!Array.isArray(data.bakery)) {
        data.bakery = bakeryItems;
      }
      setInventory(data);
    });
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

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

  const flattenLunchDinner = (mealObj) =>
    subcategories.flatMap((sub) => mealObj[sub] || []);

  const handleCustomTitleChange = (e) => {
    setCustomMenu((prev) => ({ ...prev, title: e.target.value }));
  };

  const handleCustomTeluguTitleChange = (e) => {
    setCustomMenu((prev) => ({ ...prev, teluguTitle: e.target.value }));
  };

  const handleCustomItemChange = (index, field, value) => {
    const updated = [...customMenu.items];
    updated[index][field] = value;
    setCustomMenu((prev) => ({ ...prev, items: updated }));
  };

  const addCustomItem = () => {
    setCustomMenu((prev) => ({
      ...prev,
      items: [...prev.items, { name: "", telugu: "", price: "" }],
    }));
  };

  const removeCustomItem = (index) => {
    const updated = [...customMenu.items];
    updated.splice(index, 1);
    setCustomMenu((prev) => ({ ...prev, items: updated }));
  };

  const formatEnglishSection = (emoji, title, items, deadline, dateLabel) => {
    const allItems = Object.values(items).flat();
    if (allItems.length === 0) return "";
    const lines = Object.entries(items)
      .map(([sub, arr]) =>
        arr.map((i) => `- ${i.name}${i.price ? ` - ₹${i.price}` : ""}`).join("\n")
      )
      .join("\n");
    return `\n${emoji} *${title}*\n${lines}\n\n🕒 *Order by:*\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━`;
  };

  const formatTeluguSection = (emoji, title, items, deadline, dateLabel) => {
    const allItems = Object.values(items).flat();
    if (allItems.length === 0) return "";
    const lines = Object.entries(items)
      .map(([sub, arr]) =>
        arr.map((i) => `- ${i.telugu || i.name}${i.price ? ` - ₹${i.price}` : ""}`).join("\n")
      )
      .join("\n");
    return `\n${emoji} ${title}\n${lines}\n\n🕒 ఆర్డర్ గడువు:\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━`;
  };

  const generateMessageAndSaveMenu = async () => {
    const deliveryDay = format(new Date(deliveryDate), "dd/MMMM/yyyy");

    const teluguMealsMsg =
      `🍲 మా ఇంటి వంట మీకు!\n\n📅 డెలివరీ తేదీ:\n ${deliveryDay}` +
      formatTeluguSection("🌞", "టిఫిన్", { breakfast: selected.breakfast }, "06:00 AM", deliveryDay) +
      formatTeluguSection("🍚", "మధ్యాహ్న భోజనం", selected.lunch, "09:00 AM", deliveryDay) +
      formatTeluguSection("🌙", "రాత్రి భోజనం", selected.dinner, "05:00 PM", deliveryDay) +
      `\n\n🚚 డెలివరీ సమయాలు:\n🌞 టిఫిన్: 07:30 - 08:30 AM\n🍚 మధ్యాహ్న భోజనం: 12:30 - 01:30 PM\n🌙 రాత్రి భోజనం: 08:00 - 09:00 PM\n\n📦 డెలివరీ ఛార్జీలు:\n3 కి.మీ లోపు – ₹30\n3 కి.మీ - 6 కి.మీ – ₹60\n\nధన్యవాదాలు!`;

    const englishMealsMsg =
      `🍽️ *Maa Inti Vanta - just for you*\n\n📅 *Delivery Date:*\n ${deliveryDay}` +
      formatEnglishSection("🌞", "Breakfast", { breakfast: selected.breakfast }, "06:00 AM", deliveryDay) +
      formatEnglishSection("🍚", "Lunch", selected.lunch, "09:00 AM", deliveryDay) +
      formatEnglishSection("🌙", "Dinner", selected.dinner, "05:00 PM", deliveryDay) +
      `\n\n🚚 *Delivery Timings:*\n🌞Breakfast: 07:30 - 08:30 AM\n🍚Lunch: 12:30 - 01:30 PM\n🌙Dinner: 08:00 - 09:00 PM\n\n📦 *Delivery Charges:*\n3 KM – ₹30\n3 KM - 6 KM – ₹60\n\nThank You!`;

    const bakeryMsg =
      `🍽 Maa Inti Vanta - just for you\n📅 Delivery Date: ${deliveryDay}` +
      formatEnglishSection("🍰", "Bakery", { bakery: selected.bakery }, "04:00 PM", deliveryDay) +
      formatTeluguSection("🍰", "బేకరీ", { bakery: selected.bakery }, "04:00 PM", deliveryDay) +
      `\n🚚 Delivery Timings/డెలివరీ సమయాలు:\n🍰Bakery: 06:30 PM\n🍰 బేకరీ: 06:30 PM`;

    const customMenuItemsFiltered = customMenu.items.filter(
      (item) => item.name.trim() && item.price
    );

    let customMsg = "";
    if (customMenuItemsFiltered.length > 0) {
      const customEnglishLines = customMenuItemsFiltered
        .map((i) => `- ${i.name} - ₹${i.price}`)
        .join("\n");
      const customTeluguLines = customMenuItemsFiltered
        .map((i) => `- ${i.telugu || i.name} - ₹${i.price}`)
        .join("\n");
      customMsg =
        `🍽 *Maa Inti Vanta - just for you*\n📅 *Delivery Date: ${deliveryDay}*\n` +
        `✨ ${customMenu.title}\n${customEnglishLines}\n━━━━━━━━━━━━━━━\n` +
        `✨ ${customMenu.teluguTitle || customMenu.title}\n${customTeluguLines}`;
    }

    setBillTeluguMeals(teluguMealsMsg);
    setBillEnglishMeals(englishMealsMsg);
    setBillBakery(bakeryMsg);
    setBillCustom(customMsg);

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

    if (customMenuItemsFiltered.length > 0) {
      menuData[customMenu.title.toLowerCase().replace(/\s+/g, "_")] = customMenuItemsFiltered.map(item => ({
        name: item.name,
        telugu: item.telugu,
        price: Number(item.price),
      }));
    }

    await update(menuRef, menuData);
    setSelected({ breakfast: [], lunch: {}, dinner: [], bakery: [] });
    setCustomMenu({ title: "Custom Menu", teluguTitle: "", items: [] });
    alert("✅ Menu generated and saved for " + deliveryDate);
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
        <Input
          type="date"
          value={deliveryDate}
          onChange={e => setDeliveryDate(e.target.value)}
        />
      </div>

      {deliveryDate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="bg-gray-800 border border-gray-700 text-gray-100 max-w-[260px] w-full">
            <CardContent className="space-y-2 p-4">
              <h2 className="text-xl font-semibold capitalize">Breakfast</h2>
              <Label>Select Items</Label>
              <SearchableDropdown
                items={sortByName(inventory.breakfast)}
                placeholder="Select item..."
                onSelect={(itemName) => addItem("breakfast", itemName)}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {selected.breakfast.map((item) => (
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

          <Card className="bg-gray-800 border border-gray-700 text-gray-100 max-w-[260px] w-full">
            <CardContent className="space-y-2 p-4">
              <h2 className="text-xl font-semibold capitalize">Lunch</h2>
              {subcategories.map((sub) => (
                <div key={sub}>
                  <Label>Select {sub.charAt(0).toUpperCase() + sub.slice(1)}</Label>
                  <SearchableDropdown
                    items={sortByName(inventory.lunchDinner?.[sub] || [])}
                    placeholder="Select item..."
                    onSelect={(itemName) => addItem("lunch", `${sub}::${itemName}`)}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(selected.lunch[sub] || []).map((item) => (
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

          <Card className="bg-gray-800 border border-gray-700 text-gray-100 max-w-[260px] w-full">
            <CardContent className="space-y-2 p-4">
              <h2 className="text-xl font-semibold capitalize">Dinner</h2>
              {subcategories.map((sub) => (
                <div key={sub}>
                  <Label>Select {sub.charAt(0).toUpperCase() + sub.slice(1)}</Label>
                  <SearchableDropdown
                    items={sortByName(inventory.lunchDinner?.[sub] || [])}
                    placeholder="Select item..."
                    onSelect={(itemName) => addItem("dinner", `${sub}::${itemName}`)}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(selected.dinner[sub] || []).map((item) => (
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

          <Card className="bg-gray-800 border border-gray-700 text-gray-100 max-w-[260px] w-full">
            <CardContent className="space-y-2 p-4">
              <h2 className="text-xl font-semibold capitalize">Bakery</h2>
              <Label>Select Items</Label>
              <SearchableDropdown
                items={sortByName(inventory.bakery)}
                placeholder="Select item..."
                onSelect={(itemName) => addItem("bakery", itemName)}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {selected.bakery.map((item) => (
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

          <Card className="bg-gray-800 border border-gray-700 text-gray-100 max-w-[260px] w-full">
            <CardContent className="space-y-2 p-4">
              <Input
                value={customMenu.title}
                onChange={handleCustomTitleChange}
                className="bg-gray-700 text-white font-semibold text-lg"
                placeholder="Custom Menu Title (English)"
              />
              <Input
                value={customMenu.teluguTitle}
                onChange={handleCustomTeluguTitleChange}
                className="bg-gray-700 text-white font-semibold text-lg"
                placeholder="Custom Menu Title (Telugu)"
              />
              <Label>Add Custom Items</Label>
              {customMenu.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={item.name}
                    onChange={(e) => handleCustomItemChange(idx, "name", e.target.value)}
                    placeholder="Item name (English)"
                    className="bg-gray-700 text-white flex-1"
                  />
                  <Input
                    value={item.telugu || ""}
                    onChange={(e) => handleCustomItemChange(idx, "telugu", e.target.value)}
                    placeholder="Item name (Telugu)"
                    className="bg-gray-700 text-white flex-1"
                  />
                  <Input
                    type="number"
                    value={item.price}
                    onChange={(e) => handleCustomItemChange(idx, "price", e.target.value)}
                    placeholder="₹"
                    className="bg-gray-700 text-white w-24"
                  />
                  <Button variant="destructive" onClick={() => removeCustomItem(idx)}>
                    ❌
                  </Button>
                </div>
              ))}
              <Button onClick={addCustomItem} className="mt-2">
                ➕ Add Item
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Button className="mt-4" onClick={generateMessageAndSaveMenu}>
        Generate Message & Save Menu
      </Button>

      {(billTeluguMeals || billEnglishMeals || billBakery || billCustom) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {billTeluguMeals && (
            <div>
              <Label>Telugu Meals</Label>
              <Textarea value={billTeluguMeals} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billTeluguMeals)}>
                📋 Copy Telugu Meals
              </Button>
            </div>
          )}
          {billEnglishMeals && (
            <div>
              <Label>English Meals</Label>
              <Textarea value={billEnglishMeals} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billEnglishMeals)}>
                📋 Copy English Meals
              </Button>
            </div>
          )}
          {billBakery && (
            <div>
              <Label>Bakery (Telugu + English)</Label>
              <Textarea value={billBakery} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billBakery)}>
                📋 Copy Bakery
              </Button>
            </div>
          )}
          {billCustom && (
            <div>
              <Label>Custom Menu (Telugu + English)</Label>
              <Textarea value={billCustom} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billCustom)}>
                📋 Copy Custom
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
