import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import SearchableDropdown from "./SearchableDropdown";

const subcategories = ["daal", "curry", "pickle", "sambar", "others"];

export default function MealTypeCards({
  inventory,
  selected,
  customMenu,
  setCustomMenu,
  addItem,
  removeItem,
  handleCustomChange,
  addCustomItem,
  removeCustomItem,
}) {
  const handleTitleChange = (e) => {
    setCustomMenu(prev => ({ ...prev, title: e.target.value }));
  };

  const handleTeluguTitleChange = (e) => {
    setCustomMenu(prev => ({ ...prev, teluguTitle: e.target.value }));
  };

  const handleDeliveryFromChange = (e) => {
    setCustomMenu(prev => ({ ...prev, deliveryFrom: e.target.value }));
  };

  const handleDeliveryToChange = (e) => {
    setCustomMenu(prev => ({ ...prev, deliveryTo: e.target.value }));
  };

  const handleOrderByChange = (e) => {
    setCustomMenu(prev => ({ ...prev, orderBy: e.target.value }));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card className="bg-gray-800 border border-gray-700 text-white max-w-[260px] w-full">
        <CardContent>
          <h2 className="text-xl font-semibold capitalize">Breakfast</h2>
          <Label>Select Items</Label>
          <SearchableDropdown
            items={inventory.breakfast}
            placeholder="Select item"
            onSelect={(item) => addItem("breakfast", item)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.breakfast.map(i => (
              <span
                key={i.name}
                className="bg-blue-600 rounded-full px-3 py-1 text-sm cursor-pointer hover:bg-blue-700"
                onClick={() => removeItem("breakfast", "", i.name)}
              >
                {i.name} ×
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border border-gray-700 text-white max-w-[260px] w-full">
        <CardContent>
          <h2 className="text-xl font-semibold capitalize">Lunch</h2>
          {subcategories.map(sub => (
            <div key={sub} className="mb-4">
              <Label>Select {sub}</Label>
              <SearchableDropdown
                items={inventory.lunchDinner?.[sub] || []}
                placeholder={`Select ${sub} item`}
                onSelect={(item) => addItem("lunch", `${sub}::${item}`)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {(selected.lunch[sub] || []).map(i => (
                  <span
                    key={i.name}
                    className="bg-blue-600 rounded-full px-3 py-1 text-sm cursor-pointer hover:bg-blue-700"
                    onClick={() => removeItem("lunch", sub, i.name)}
                  >
                    {i.name} ×
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border border-gray-700 text-white max-w-[260px] w-full">
        <CardContent>
          <h2 className="text-xl font-semibold capitalize">Dinner</h2>
          {subcategories.map(sub => (
            <div key={sub} className="mb-4">
              <Label>Select {sub}</Label>
              <SearchableDropdown
                items={inventory.lunchDinner?.[sub] || []}
                placeholder={`Select ${sub} item`}
                onSelect={(item) => addItem("dinner", `${sub}::${item}`)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {(selected.dinner[sub] || []).map(i => (
                  <span
                    key={i.name}
                    className="bg-blue-600 rounded-full px-3 py-1 text-sm cursor-pointer hover:bg-blue-700"
                    onClick={() => removeItem("dinner", sub, i.name)}
                  >
                    {i.name} ×
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border border-gray-700 text-white max-w-[260px] w-full">
        <CardContent>
          <h2 className="text-xl font-semibold capitalize">Bakery</h2>
          <Label>Select Items</Label>
          <SearchableDropdown
            items={inventory.bakery}
            placeholder="Select bakery item"
            onSelect={(item) => addItem("bakery", item)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.bakery.map(i => (
              <span
                key={i.name}
                className="bg-purple-600 rounded-full px-3 py-1 text-sm cursor-pointer hover:bg-purple-700"
                onClick={() => removeItem("bakery", "", i.name)}
              >
                {i.name} ×
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border border-gray-700 text-white max-w-[260px] w-full">
        <CardContent>
          <Input
            value={customMenu.title}
            onChange={handleTitleChange}
            placeholder="Custom Menu Title"
            className="mb-2 bg-gray-700 rounded px-3 py-2"
          />
          <Input
            value={customMenu.teluguTitle}
            onChange={handleTeluguTitleChange}
            placeholder="Custom Menu Title (Telugu)"
            className="mb-4 bg-gray-700 rounded px-3 py-2"
          />
          <div className="mb-4">
            <Label>Order By Time</Label>
            <Input
              type="time"
              value={customMenu.orderBy || ""}
              onChange={handleOrderByChange}
              className="bg-gray-700 rounded px-3 py-2"
            />
          </div>
          <div className="mb-4">
            <Label>Delivery Time</Label>
            <div className="flex gap-2">
              <Input
                type="time"
                value={customMenu.deliveryFrom || ""}
                onChange={handleDeliveryFromChange}
                className="bg-gray-700 rounded px-3 py-2"
              />
              <Input
                type="time"
                value={customMenu.deliveryTo || ""}
                onChange={handleDeliveryToChange}
                className="bg-gray-700 rounded px-3 py-2"
              />
            </div>
          </div>
          <Label>Add Custom Items</Label>
          {customMenu.items.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <Input
                value={item.name}
                onChange={(e) => handleCustomChange(idx, "name", e.target.value)}
                placeholder="Item Name"
                className="flex-1 bg-gray-700 rounded px-3 py-2"
              />
              <Input
                value={item.telugu || ""}
                onChange={(e) => handleCustomChange(idx, "telugu", e.target.value)}
                placeholder="Telugu Name"
                className="flex-1 bg-gray-700 rounded px-3 py-2"
              />
              <Input
                type="number"
                value={item.price}
                onChange={(e) => handleCustomChange(idx, "price", e.target.value)}
                placeholder="₹ Price"
                className="w-24 bg-gray-700 rounded px-3 py-2"
              />
              <Button
                variant="destructive"
                onClick={() => removeCustomItem(idx)}
              >
                ❌
              </Button>
            </div>
          ))}
          <Button onClick={addCustomItem} className="w-full mt-2">
            ➕ Add Item
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
