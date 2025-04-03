// Ensure websim.js exists or is created if needed.
// This file is typically provided by the websim environment.
// If it doesn't exist, create a placeholder or add necessary mock functions.

// Example placeholder if needed:
// class WebsimSocket {
//   constructor() {
//     this.collections = {};
//     this.currentUser = { username: `User_${Math.floor(Math.random() * 1000)}` };
//     console.log("Using Mock WebsimSocket");
//   }
//   collection(name) {
//     if (!this.collections[name]) {
//       this.collections[name] = new MockCollection(name, this);
//     }
//     return this.collections[name];
//   }
//   getCurrentUser() {
//      return Promise.resolve(this.currentUser);
//   }
//   async upload(file) {
//     console.log(`Mock uploading ${file.name}`);
//     await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
//     return `https://fake-upload-url.com/${file.name}`;
//   }
// }

// class MockCollection {
//   constructor(name, socket) {
//     this.name = name;
//     this.socket = socket;
//     this.data = []; // In-memory store
//     this.subscribers = [];
//     this.filters = {}; // Store current filter
//   }
//   _notifySubscribers() {
//     const filteredData = this._getFilteredList();
//     this.subscribers.forEach(cb => cb(filteredData));
//   }
//   filter(filterObj) {
//      this.filters = filterObj || {};
//      // Return `this` to allow chaining subscribe/getList
//      // In a real scenario, this might return a new filtered collection instance
//      return this;
//   }
//   _matchesFilter(item) {
//      for (const key in this.filters) {
//          if (item[key] !== this.filters[key]) {
//              return false;
//          }
//      }
//      return true;
//   }
//    _getFilteredList() {
//      return this.data.filter(item => this._matchesFilter(item)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort newest first
//    }
//   getList() {
//     console.log(`Mock getList for ${this.name} with filter`, this.filters);
//     return this._getFilteredList();
//   }
//   subscribe(callback) {
//     console.log(`Mock subscribe for ${this.name} with filter`, this.filters);
//     this.subscribers.push(callback);
//     // Immediate call with current data
//     callback(this._getFilteredList());
//     // Return unsubscribe function
//     return () => {
//       this.subscribers = this.subscribers.filter(cb => cb !== callback);
//     };
//   }
//   async create(recordData) {
//     console.log(`Mock create for ${this.name}`, recordData);
//     await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
//     const newRecord = {
//       ...recordData,
//       id: `mock_${this.name}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
//       username: this.socket.currentUser.username,
//       created_at: new Date().toISOString(),
//     };
//     this.data.push(newRecord);
//     this._notifySubscribers(); // Notify after adding
//     return newRecord;
//   }
//   async update(id, updateData) {
//      console.log(`Mock update for ${this.name}`, id, updateData);
//      await new Promise(resolve => setTimeout(resolve, 100));
//      const index = this.data.findIndex(item => item.id === id && item.username === this.socket.currentUser.username);
//      if (index !== -1) {
//          this.data[index] = { ...this.data[index], ...updateData };
//          this._notifySubscribers(); // Notify after update
//          return true;
//      }
//      console.warn(`Mock update failed: Record ${id} not found or permission denied.`);
//      return false; // Or throw error
//   }
//   async delete(id) {
//      console.log(`Mock delete for ${this.name}`, id);
//      await new Promise(resolve => setTimeout(resolve, 100));
//      const initialLength = this.data.length;
//      this.data = this.data.filter(item => !(item.id === id && item.username === this.socket.currentUser.username));
//      if (this.data.length < initialLength) {
//           this._notifySubscribers(); // Notify after delete
//           return true;
//      }
//       console.warn(`Mock delete failed: Record ${id} not found or permission denied.`);
//       return false; // Or throw error
//   }
// }

// // Assign to window if in a browser context
// if (typeof window !== 'undefined') {
//     window.WebsimSocket = WebsimSocket;
//     // Mock websim object if needed for other functions like upload
//     window.websim = window.websim || {
//          upload: (file) => new WebsimSocket().upload(file), // Use instance method
//          getCreatedBy: () => Promise.resolve({ username: 'mock_creator' }),
//          // Add other necessary mock functions
//      };
// }

// export { WebsimSocket }; // Export for module usage
`````` index.html
<!DOCTYPE html>
<html>
<head>
  <title>Infinite 3D Stair Climber</title>
  <style>
    body { margin: 0; overflow: hidden; background-color: #87CEEB; font-family: sans-serif; }
    canvas { display: block; }
    .info {
      position: absolute;
      top: 10px;
      left: 10px;
      color: white;
      background-color: rgba(0,0,0,0.5);
      padding: 10px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 10;
    }
    #leaderboard {
      position: absolute;
      top: 10px;
      right: 10px;
      color: white;
      background-color: rgba(0,0,0,0.5);
      padding: 10px;
      border-radius: 5px;
      max-height: calc(100vh - 40px); /* Limit height */
      width: 200px;
      overflow-y: auto;
      font-size: 14px;
      z-index: 10;
    }
    #leaderboard h3 { margin-top: 0; margin-bottom: 10px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.5); padding-bottom: 5px; }
    #leaderboard ul { list-style: none; padding: 0; margin: 0; }
    #leaderboard li { margin-bottom: 8px; display: flex; align-items: center; }
    #leaderboard li img { width: 24px; height: 24px; vertical-align: middle; margin-right: 8px; border-radius: 50%; border: 1px solid #fff;}
    #leaderboard .score { font-weight: bold; margin-left: auto; } /* Push score to the right */
  </style>
</head>
<body>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/",
        "websim": "/websim.js"
      }
    }
  </script>
  <div class="info">
    Press SPACE to climb!
    <div id="my-score">My Score: 0</div>
  </div>
  <div id="leaderboard">
    <h3>Leaderboard</h3>
    <ul id="leaderboard-list"></ul>
  </div>
  <script type="module" src="/main.js"></script>
</body>
</html>

// This file should be provided by the websim environment.
// No changes needed unless debugging locally without the environment.
// If creating a placeholder for local testing:
/*
class WebsimSocket {
  constructor(url = 'ws://localhost:8080') {
    this.url = url;
    this.ws = null;
    this.collections = {};
    this._currentUser = { username: `User_${Math.floor(Math.random() * 1000)}`, id: `mock_user_${Date.now()}` }; // Mock user
    this.messageQueue = [];
    this.isConnected = false;
    this.messageIdCounter = 0;
    this.pendingRequests = new Map();
    // this.connect(); // Auto-connect removed for clarity, rely on method calls
    console.log("Using Mock WebsimSocket");
  }

  // Basic connection logic (mock)
  connect() {
    return new Promise((resolve) => {
        if (this.isConnected) {
            resolve();
            return;
        }
        console.log("Mock connecting...");
        setTimeout(() => {
            this.isConnected = true;
            console.log("Mock connected.");
            // Process any queued messages
            this.messageQueue.forEach(msg => this._send(msg));
            this.messageQueue = [];
            resolve();
        }, 50); // Simulate connection delay
    });
  }

  // Basic send logic (mock)
  _send(message) {
    if (!this.isConnected) {
        console.log("Queueing message:", message);
        this.messageQueue.push(message);
        this.connect(); // Attempt to connect if not already
        return;
    }
    // Simulate sending and receiving response for requests
    console.log("Mock sending:", message);
    if (message.type === 'request') {
      // Simulate responses for specific mock actions
      setTimeout(() => {
        const callback = this.pendingRequests.get(message.id);
        if (callback) {
          let responsePayload = {};
          if (message.action === 'collection:create' && message.collection === 'user_stairs_v2') {
            responsePayload = {
                ...message.payload,
                id: `mock_record_${Date.now()}`,
                username: this._currentUser.username,
                created_at: new Date().toISOString(),
            };
            // Store locally in mock collection
             const coll = this.collection(message.collection);
             coll._localData.push(responsePayload);
             coll._notifySubscribers();

          } else if (message.action === 'collection:update' && message.collection === 'user_stairs_v2') {
             const coll = this.collection(message.collection);
             const recordIndex = coll._localData.findIndex(r => r.id === message.recordId && r.username === this._currentUser.username);
              if (recordIndex > -1) {
                  coll._localData[recordIndex] = { ...coll._localData[recordIndex], ...message.payload };
                  responsePayload = coll._localData[recordIndex];
                   coll._notifySubscribers();
              } else {
                  // Simulate error if needed
                   console.error(`Mock update failed for ${message.recordId}`);
                   callback.reject(new Error("Update failed"));
                   this.pendingRequests.delete(message.id);
                   return;
              }
          }
           else if (message.action === 'user:get') {
             responsePayload = this._currentUser;
          }
          // --- Add more mock responses as needed ---


          callback.resolve(responsePayload);
          this.pendingRequests.delete(message.id);
        }
      }, 150); // Simulate network latency
    }
  }

  _sendRequest(action, collection, payload, recordId = null) {
      return new Promise(async (resolve, reject) => {
          await this.connect(); // Ensure connection before sending
          const messageId = this.messageIdCounter++;
          const message = {
              type: 'request',
              id: messageId,
              action: action,
              collection: collection,
              payload: payload,
              recordId: recordId, // Include recordId for update/delete
          };
          this.pendingRequests.set(messageId, { resolve, reject });
          this._send(message);
          // Timeout for requests (optional)
          setTimeout(() => {
              if (this.pendingRequests.has(messageId)) {
                   console.warn(`Request ${messageId} (${action}) timed out.`);
                   this.pendingRequests.get(messageId).reject(new Error('Request timed out'));
                   this.pendingRequests.delete(messageId);
              }
          }, 5000); // 5 second timeout
      });
  }


  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new MockCollection(name, this);
    }
    return this.collections[name];
  }

  getCurrentUser() {
     // Simulate fetching user data
     // return Promise.resolve(this._currentUser);
      return this._sendRequest('user:get', null, {});
  }

  // Mock upload function
   async upload(file) {
     console.log(`Mock uploading ${file.name}...`);
     await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
     const mockUrl = `https://mock-upload-url.test/${Date.now()}-${file.name}`;
     console.log(`Mock upload complete: ${mockUrl}`);
     return mockUrl;
   }
}

class MockCollection {
  constructor(name, socket) {
    this.name = name;
    this.socket = socket;
    this._localData = []; // In-memory store for this specific collection
    this._subscribers = [];
    this._filters = {}; // Store current filter for getList/subscribe
     this._isSubscribed = false; // Track if a persistent subscription is active
  }

  _notifySubscribers() {
    const filteredData = this.getList(); // Use getList to apply filters
    // console.log(`Notifying ${this._subscribers.length} subscribers for ${this.name} with:`, filteredData);
    this._subscribers.forEach(({ callback }) => {
        try {
             callback(filteredData);
        } catch(e) {
            console.error("Error in subscriber callback:", e);
        }
    });
  }

   // --- Important: Filter logic ---
   // Return a new object representing the filtered state for useSyncExternalStore compatibility
   filter(filterObj) {
       // Create a new filtered instance (or representation)
       const filteredCollection = new MockCollection(this.name, this.socket);
       filteredCollection._localData = this._localData; // Share data store (could clone if needed)
       filteredCollection._filters = filterObj || {};
       // Carry over subscribers? No, subscribe should be called on the filtered object.
       return filteredCollection;
   }

  _matchesFilter(item) {
     for (const key in this._filters) {
         // Handle null comparison specifically
         if (this._filters[key] === null) {
             if (item[key] !== null && item[key] !== undefined) return false;
         } else if (item[key] !== this._filters[key]) {
             return false;
         }
     }
     return true;
  }

   getList() {
     // console.log(`Mock getList for ${this.name} with filter`, this._filters);
     // Simulate fetching data if not subscribed? For simplicity, just use local cache.
     // In a real scenario, this might trigger a one-time fetch if data isn't available/subscribed.
     return this._localData
         .filter(item => this._matchesFilter(item))
         .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort newest first
   }

  subscribe(callback) {
     const subscriberId = Math.random().toString(36).substring(2); // Unique ID for this subscription instance
     console.log(`Mock subscribe for ${this.name} (ID: ${subscriberId}) with filter`, this._filters);

     const subscriber = { id: subscriberId, callback, filters: this._filters };
     this._subscribers.push(subscriber);

     // Simulate server subscription if this is the first subscribe call for this *base* collection
     if (!this.socket.collections[this.name]._isSubscribed) {
          console.log(`(${this.name}) First subscriber, initiating mock server subscription.`);
          this.socket.collections[this.name]._isSubscribed = true;
          // Simulate receiving initial data push from server after subscribing
          // This would involve a message to the server in a real implementation
          setTimeout(() => {
               // Fetch ALL data for the base collection and store locally
               // In a real scenario, server pushes data matching the subscription filters
               console.log(`(${this.name}) Simulating initial data receive`);
               // Add some mock initial data if empty for testing
               if (this.name === 'user_stairs_v2' && this._localData.length === 0) {
                 this._localData.push({ id: 'mock_other_1', username: 'Alice', score: 5, created_at: new Date(Date.now() - 10000).toISOString() });
                 this._localData.push({ id: 'mock_other_2', username: 'Bob', score: 3, created_at: new Date(Date.now() - 5000).toISOString() });
               }
               this._notifySubscribers(); // Notify all subscribers with initial data
          }, 200);
     } else {
        // If already subscribed, immediately call back with current data
         setTimeout(() => callback(this.getList()), 0); // Use timeout for async behavior like real subscribe
     }


     // Return unsubscribe function
     return () => {
       console.log(`Mock unsubscribe for ${this.name} (ID: ${subscriberId})`);
       this.socket.collections[this.name]._subscribers = this.socket.collections[this.name]._subscribers.filter(s => s.id !== subscriberId);

       // Optional: Simulate unsubscribing from server if no subscribers remain for the base collection
        if (this.socket.collections[this.name]._subscribers.length === 0) {
            console.log(`(${this.name}) No subscribers left, simulating server unsubscribe.`);
            this.socket.collections[this.name]._isSubscribed = false;
            // Send unsubscribe message to server in real implementation
        }
     };
   }

   // CRUD operations using the request mechanism
   async create(recordData) {
     console.log(`Mock create request for ${this.name}`, recordData);
     return this.socket._sendRequest('collection:create', this.name, recordData);
   }

   async update(id, updateData) {
      console.log(`Mock update request for ${this.name}`, id, updateData);
      // Permission check simulation (only own records)
      const record = this._localData.find(r => r.id === id);
       if (record && record.username !== this.socket._currentUser.username) {
           console.warn(`Mock update permission denied for record ${id}`);
           throw new Error("Permission denied"); // Simulate server rejection
       }
      return this.socket._sendRequest('collection:update', this.name, updateData, id);
   }

   async delete(id) {
      console.log(`Mock delete request for ${this.name}`, id);
        // Permission check simulation
        const record = this._localData.find(r => r.id === id);
        if (record && record.username !== this.socket._currentUser.username) {
            console.warn(`Mock delete permission denied for record ${id}`);
             throw new Error("Permission denied");
        }
       // Local removal simulation (before waiting for response) - optional optimistic update
       const initialLength = this._localData.length;
       this._localData = this._localData.filter(item => !(item.id === id && item.username === this.socket._currentUser.username));
       if (this._localData.length < initialLength) {
            this._notifySubscribers(); // Notify after optimistic delete
       } else {
            console.warn(`Mock delete failed locally: Record ${id} not found or permission denied.`);
            // Don't even send request if known fail locally? Or let server handle denial.
       }
       // Send actual request (even if optimistic update failed, maybe server state differs)
       return this.socket._sendRequest('collection:delete', this.name, null, id);
   }
}

// Assign to window if in a browser context
if (typeof window !== 'undefined') {
    window.WebsimSocket = WebsimSocket;
    // Mock websim object if needed for other functions like upload
     window.websim = window.websim || {
         upload: (file) => new WebsimSocket().upload(file), // Use instance method
         getCreatedBy: () => Promise.resolve({ username: 'mock_creator' }),
         getCurrentUser: () => new WebsimSocket().getCurrentUser(), // Use instance method
         // Add other necessary mock functions
     };
}

export { WebsimSocket }; // Export for module usage
*/

