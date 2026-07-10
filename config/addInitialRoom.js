import { Room } from "../models/pricing.model.js";
// import { rooms } from "./room.js";

const PROPERTY_ID = "69e9b49f54b20cd6c8b5ab3f";

const rooms = [
  {
    roomId: "R1",
    description:
      "A spacious ground floor retreat with a king and queen bed, designed for comfort and ease. Ideal for families or groups of up to 4 guests.",
  },
  {
    roomId: "R2",
    description:
      "An intimate ground floor suite with a queen bed and a private living area for added comfort. Ideal for 2 adults and 1 child (max 3 guests).",
  },
  {
    roomId: "R3",
    description:
      "An elevated first floor suite with a king bed, a single bed and a convertible sofa. Ideal for families or groups of up to 4 guests.",
  },
  {
    roomId: "R4",
    description:
      "A refined first floor suite offering a king bed, a single bed and a convertible sofa for a comfortable stay. Ideal for families or groups of up to 4 guests.",
  },
];

export const modDesc = async () => {
  try {
    let srooms = await Room.find({ propertyId: PROPERTY_ID });
    console.log("rooms before update", srooms);

    await Promise.all(
      rooms.map((room) => {
        const filter = {
          propertyId: PROPERTY_ID,
          roomId: room.roomId,
        };

        const update = { description: room.description };

        return Room.findOneAndUpdate(filter, update, {
          new: true, // return updated doc
          upsert: false, // set true if you want to create if not found
        });
      }),
    );

    srooms = await Room.find({ propertyId: PROPERTY_ID });
    console.log("rooms after update", srooms);
  } catch (error) {
    console.error("error mod room", error);
  }
};

// export const addInitalPrices = async () => {
//   try {
//     const roomEntryExists = await Room.findOne({
//       propertyId: PROPERTY_ID,
//     });
//
//     if (!roomEntryExists) {
//       await Room.insertMany(
//         Object.entries(rooms).map(([roomId, room]) => ({
//           propertyId: PROPERTY_ID, // ✅ THIS WAS MISSING
//           roomId,
//           name: room.name,
//           type: room.type,
//           description: room.description,
//           pricePerNight: room.price,
//           capacity: room.capacity,
//         })),
//       );
//
//       console.log("Base Prices added");
//     } else {
//       console.log("Base Prices already exist");
//     }
//   } catch (error) {
//     console.log("Error adding base price");
//     console.log(error.message);
//   }
// };
