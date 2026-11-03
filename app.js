
// ======================================
// TASK MANAGER - SUPABASE CONNECTION
// ======================================

let SUPABASE_URL = "";
let SUPABASE_KEY = "";
let TABLE_NAME = "tasks";

let editingTaskId = null;

// HTML elements
const taskForm = document.getElementById("task-form");
const taskTitle = document.getElementById("task-title");
const taskDescription = document.getElementById("task-description");
const taskList = document.getElementById("task-list");
const taskSubmit = document.getElementById("task-submit");
const statusMessage = document.getElementById("status-message");
const formHeading = document.getElementById("form-heading");

// ======================================
// DISPLAY STATUS MESSAGES
// ======================================

function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "#d93636" : "#16834e";
}

// ======================================
// INITIALIZE APPLICATION
// ======================================

async function initializeApp() {
    try {
        const response = await fetch("./config.json");

        if (!response.ok) {
            throw new Error("Could not load config.json");
        }

        const config = await response.json();

        SUPABASE_URL = config.supabaseUrl.replace(/\/+$/, "");
        SUPABASE_KEY = config.supabasePublishableKey;
        TABLE_NAME = config.tableName;

        if (!SUPABASE_URL || !SUPABASE_KEY || TABLE_NAME !== "tasks") {
            throw new Error("Invalid Supabase configuration");
        }

        await loadTasks();

    } catch (error) {
        console.error(error);
        showMessage("Connection error: " + error.message, true);
    }
}

// ======================================
// SUPABASE API REQUEST
// ======================================

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${endpoint}`,
        {
            ...options,
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                ...options.headers
            }
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Supabase API request failed");
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// ======================================
// GET - LOAD ALL TASKS
// ======================================

async function loadTasks() {
    try {
        showMessage("Loading tasks...");

        const tasks = await apiRequest(
            `${TABLE_NAME}?select=*&order=id.desc`
        );

        displayTasks(tasks);

        showMessage(
            tasks.length === 0
                ? "No tasks yet. Add your first task!"
                : `${tasks.length} task(s) loaded successfully.`
        );

    } catch (error) {
        console.error(error);
        showMessage("Could not load tasks: " + error.message, true);
    }
}

// ======================================
// DISPLAY TASKS ON THE PAGE
// ======================================

function displayTasks(tasks) {
    taskList.replaceChildren();

    tasks.forEach(task => {
        const item = document.createElement("article");
        item.className = "task-item" + (task.completed ? " completed" : "");
        item.dataset.id = task.id;

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description || "No description";

        const status = document.createElement("span");
        status.className = "task-status";
        status.textContent = task.completed ? "Completed" : "Incomplete";

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "edit-task";
        editButton.textContent = "Edit";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-task";
        deleteButton.textContent = "Delete";

        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "toggle-task";
        toggleButton.textContent = task.completed
            ? "Mark Incomplete"
            : "Mark Complete";

        actions.append(editButton, deleteButton, toggleButton);

        item.append(title, description, status, actions);
        taskList.appendChild(item);
    });
}

// ======================================
// POST - ADD A NEW TASK
// ======================================

taskForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const title = taskTitle.value.trim();
    const description = taskDescription.value.trim();

    if (!title) {
        showMessage("Please enter a task title.", true);
        return;
    }

    try {
        taskSubmit.disabled = true;

        if (editingTaskId !== null) {
            // PATCH - UPDATE EXISTING TASK

            await apiRequest(
                `${TABLE_NAME}?id=eq.${encodeURIComponent(editingTaskId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify({
                        title: title,
                        description: description
                    })
                }
            );

            showMessage("Task updated successfully!");

        } else {
            // POST - CREATE NEW TASK

            await apiRequest(TABLE_NAME, {
                method: "POST",
                headers: {
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    completed: false
                })
            });

            showMessage("Task added successfully!");
        }

        resetForm();
        await loadTasks();

    } catch (error) {
        console.error(error);
        showMessage("Could not save task: " + error.message, true);

    } finally {
        taskSubmit.disabled = false;
    }
});

// ======================================
// EDIT - LOAD TASK INTO FORM
// ======================================

function editTask(taskItem) {
    editingTaskId = taskItem.dataset.id;

    taskTitle.value =
        taskItem.querySelector(".task-title").textContent;

    const description =
        taskItem.querySelector(".task-description").textContent;

    taskDescription.value =
        description === "No description" ? "" : description;

    formHeading.textContent = "Edit Task";
    taskSubmit.textContent = "Save Changes";

    taskTitle.focus();
    showMessage("Editing task #" + editingTaskId);
}

// ======================================
// PATCH - COMPLETE / INCOMPLETE
// ======================================

async function toggleTask(taskItem) {
    const taskId = taskItem.dataset.id;

    const currentlyCompleted =
        taskItem.classList.contains("completed");

    try {
        await apiRequest(
            `${TABLE_NAME}?id=eq.${encodeURIComponent(taskId)}`,
            {
                method: "PATCH",
                headers: {
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    completed: !currentlyCompleted
                })
            }
        );

        showMessage("Task status updated!");
        await loadTasks();

    } catch (error) {
        console.error(error);
        showMessage("Could not update task: " + error.message, true);
    }
}

// ======================================
// DELETE - REMOVE TASK
// ======================================

async function deleteTask(taskItem) {
    const taskId = taskItem.dataset.id;

    const confirmed = confirm(
        "Are you sure you want to delete this task?"
    );

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(
            `${TABLE_NAME}?id=eq.${encodeURIComponent(taskId)}`,
            {
                method: "DELETE"
            }
        );

        showMessage("Task deleted successfully!");
        await loadTasks();

    } catch (error) {
        console.error(error);
        showMessage("Could not delete task: " + error.message, true);
    }
}

// ======================================
// HANDLE TASK BUTTON CLICKS
// ======================================

taskList.addEventListener("click", function(event) {
    const button = event.target.closest("button");

    if (!button) return;

    const taskItem = button.closest(".task-item");

    if (!taskItem) return;

    if (button.classList.contains("edit-task")) {
        editTask(taskItem);

    } else if (button.classList.contains("delete-task")) {
        deleteTask(taskItem);

    } else if (button.classList.contains("toggle-task")) {
        toggleTask(taskItem);
    }
});

// ======================================
// RESET FORM
// ======================================

function resetForm() {
    taskForm.reset();
    editingTaskId = null;

    formHeading.textContent = "Add New Task";
    taskSubmit.textContent = "Add Task";
}

// ======================================
// START APPLICATION
// ======================================

initializeApp();
