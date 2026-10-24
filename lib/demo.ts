import { newPlace, type Place } from "./model";
// Real landmark coordinates, linked to their source. Prices and statuses are demo planning examples.
export function demoPlaces(): Place[] {
  return [
    {
      name: "Tower Bridge",
      images: ["/photos/tower-bridge.webp"],
      attribution:
        "Fuzzypiggy · CC BY-SA 3.0 · Wikimedia Commons: File:Tower Bridge at Dawn.jpg. Resized and converted to WebP.",
      category: "Activities",
      subcategory: "Sightseeing & Landmarks",
      area: "Southwark",
      lat: 51.5056,
      lng: -0.0753,
      description:
        "A London icon. Walk across the bridge and take in the Thames.",
      notes:
        "Demo note: leave time for a riverside stroll. Coordinates: https://en.wikipedia.org/wiki/Tower_Bridge",
      favorite: true,
      planned: true,
      priceType: "unknown",
    },
    {
      name: "British Museum",
      images: ["/photos/british-museum.webp"],
      attribution:
        "Ham · CC BY-SA 3.0 · Wikimedia Commons: File:British Museum from NE 2.JPG. Resized and converted to WebP.",
      category: "Activities",
      subcategory: "Museums & Culture",
      area: "Bloomsbury",
      lat: 51.5194,
      lng: -0.1269,
      description:
        "Two million years of history, art and culture under one roof.",
      notes:
        "Coordinates: https://en.wikipedia.org/wiki/British_Museum. Check the official site for current admission and booking requirements.",
      favorite: true,
      planned: true,
      priceType: "unknown",
    },
    {
      name: "Hyde Park",
      images: ["/photos/hyde-park.webp"],
      attribution:
        "@LondonNPC #NationalParkCity · CC BY 2.0 · Wikimedia Commons: File:Hyde Park London from the air.jpg. Resized and converted to WebP.",
      category: "Activities",
      subcategory: "Parks & Outdoors",
      area: "Westminster",
      lat: 51.50861111,
      lng: -0.16361111,
      description:
        "Make room for a slower afternoon. Wander the paths around the Serpentine.",
      notes: "Coordinates: https://en.wikipedia.org/wiki/Hyde_Park,_London",
      favorite: false,
      planned: false,
      priceType: "unknown",
    },
    {
      name: "Your next brunch spot",
      category: "Food",
      subcategory: "Breakfast & Brunch",
      area: "Add your neighbourhood",
      description:
        "A sample for your list. Replace this with a café you want to try.",
      notes:
        "Fictional demo entry. £18 is an example estimate, not a real venue price.",
      price: 18,
      priceType: "person",
      favorite: true,
      planned: true,
    },
    {
      name: "Something sweet",
      category: "Food",
      subcategory: "Desserts & Sweets",
      area: "Waiting to be discovered",
      description: "Save that pastry shop everyone keeps talking about.",
      notes: "Fictional demo entry. £8 is an example estimate.",
      price: 8,
      priceType: "person",
      favorite: false,
      planned: false,
    },
    {
      name: "Coffee & a little pause",
      category: "Food",
      subcategory: "Coffee & Drinks",
      area: "Your favourite corner",
      description: "Because the best plans leave time for a coffee break.",
      notes: "Fictional demo entry. £5 is an example estimate.",
      price: 5,
      priceType: "person",
      favorite: false,
      planned: false,
    },
  ].map(
    (p, i) =>
      ({
        ...newPlace(),
        ...p,
        demo: true,
        createdAt: new Date(Date.UTC(2026, 0, 1, 12, i)).toISOString(),
      }) as Place,
  );
}
