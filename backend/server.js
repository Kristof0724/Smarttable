const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req,res)=>res.send("SmartTable backend running"));

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/restaurants", require("./src/routes/restaurants"));
app.use("/api/reservations", require("./src/routes/reservations"));

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});

