// Sheet Configurations
const KEC_SHEET_ID = "16BznwGMZqhWqFIGWIJ1K3DhDcCJr4738byh9zcrhuK8";
const INTERAC_SHEET_ID = "1WOB0bKFoTlG42vCHmhrcwrCSWSpjD-59dfm3-axKEbs";
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxOCKIEEgZOtlkmqF2GTBdHB4v4XbRxxs8jWRBS91_8VfkyzDcHloUmpOan8ieuVmCQ/exec";

// Dynamically generate current tab name (e.g., "SEPTEMBER 2026")
function getCurrentTabName() {
  const now = new Date();
  const monthNames = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

// Format today's date to match Column B (e.g., "September 11")
function getTodayFormatted() {
  const now = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${monthNames[now.getMonth()]} ${now.getDate()}`;
}

// Fetch CSV Data directly using Sheet ID & Tab Name
async function fetchSheetData(sheetId, tabName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error("Error fetching sheet:", error);
    return [];
  }
}

// Robust CSV parser handling quotes and embedded commas
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  return lines.map(line => {
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, '').trim());
  });
}

// Filter and display available LF lessons
async function loadAvailableLessons() {
  const currentTab = getCurrentTabName();
  const todayString = getTodayFormatted();
  console.log(`Fetching lessons for tab: ${currentTab}`);

  const kecData = await fetchSheetData(KEC_SHEET_ID, currentTab);
  const interacData = await fetchSheetData(INTERAC_SHEET_ID, currentTab);

  const availableLessons = [];

  // Parse KEC (Col B=Date, Col C=Time, Col D=School, Col G=Teacher, Col H=Status)
  kecData.forEach((row, rowIndex) => {
    const date = row[1] || "";
    const lessonTime = row[2] || "";
    const school = row[3] || "";
    const teacher = row[6] || "";
    const status = row[7] || ""; // Column H

    if (status.toUpperCase().includes("LF")) {
      availableLessons.push({
        type: "KEC",
        rowIndex: rowIndex + 1, // 1-based index for Apps Script updates
        date,
        time: lessonTime,
        school,
        originalTeacher: teacher,
        status
      });
    }
  });

  // Parse Interac (Col B=Date, Col C=Access Time, Col D=Lesson Time, Col E=School, Col O=Teacher, Col P=Status)
  interacData.forEach((row, rowIndex) => {
    const date = row[1] || "";
    const accessTime = row[2] || "";
    const lessonTime = row[3] || "";
    const school = row[4] || "";
    const teacher = row[14] || "";
    const status = row[15] || ""; // Column P

    if (status.toUpperCase().includes("LF")) {
      availableLessons.push({
        type: "Interac",
        rowIndex: rowIndex + 1,
        date,
        time: `Access: ${accessTime} | Lesson: ${lessonTime}`,
        school,
        originalTeacher: teacher,
        status
      });
    }
  });

  renderCards(availableLessons);
}

function renderCards(lessons) {
  const container = document.getElementById("lessons-container");
  container.innerHTML = "";

  if (lessons.length === 0) {
    container.innerHTML = "<p>No lessons currently marked for substitution (LF).</p>";
    return;
  }

  lessons.forEach(lesson => {
    const card = document.createElement("div");
    card.className = "lesson-card";
    card.innerHTML = `
      <div class="tag ${lesson.type.toLowerCase()}">${lesson.type}</div>
      <h3>${lesson.school}</h3>
      <p><strong>Date:</strong> ${lesson.date}</p>
      <p><strong>Time:</strong> ${lesson.time}</p>
      <p><strong>Original Teacher:</strong> ${lesson.originalTeacher}</p>
      <button onclick="acceptLesson('${lesson.type}', ${lesson.rowIndex})">Accept Lesson</button>
    `;
    container.appendChild(card);
  });
}

// Action triggered when teacher clicks "Accept Lesson"
async function acceptLesson(sheetType, rowIndex) {
  const teacherName = prompt("Please enter your name to accept this lesson:");

  if (!teacherName || teacherName.trim() === "") {
    alert("Name is required to claim the lesson.");
    return;
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheetType,
        rowIndex,
        teacherName: teacherName.trim(),
      }),
    });

    alert(`Request submitted for ${teacherName}! Updating schedule...`);
    
    // Refresh card list after 2 seconds to reflect the update
    setTimeout(() => {
      loadAvailableLessons();
    }, 2000);

  } catch (error) {
    console.error("Error submitting request:", error);
    alert("Failed to update status. Please try again.");
  }
}

// Initial load on startup
loadAvailableLessons();
