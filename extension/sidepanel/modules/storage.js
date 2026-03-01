export function getSavedJobs(callback) {
  chrome.storage.local.get(["savedJobs"], (result) => {
    callback(result.savedJobs || []);
  });
}

export function setSavedJobs(jobs, callback) {
  chrome.storage.local.set({ savedJobs: jobs }, callback);
}