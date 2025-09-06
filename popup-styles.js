// popup-styles.js
document.addEventListener('DOMContentLoaded', function() {
  // Add styles for status popup
  const statusPopup = document.getElementById('status-popup');
  if (statusPopup) {
    statusPopup.style.position = 'fixed';
    statusPopup.style.bottom = '40px';
    statusPopup.style.left = '50%';
    statusPopup.style.transform = 'translateX(-50%)';
    statusPopup.style.background = 'rgba(102, 126, 234, 0.9)';
    statusPopup.style.color = 'white';
    statusPopup.style.padding = '12px 24px';
    statusPopup.style.borderRadius = '8px';
    statusPopup.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    statusPopup.style.fontWeight = '600';
    statusPopup.style.opacity = '0';
    statusPopup.style.pointerEvents = 'none';
    statusPopup.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    statusPopup.style.zIndex = '9999';
  }
  
  // Add styles for admin banner
  const adminBanner = document.getElementById('admin-banner');
  if (adminBanner) {
    adminBanner.style.display = 'none';
    adminBanner.style.position = 'absolute';
    adminBanner.style.top = '10px';
    adminBanner.style.left = '10px';
    adminBanner.style.fontWeight = 'bold';
    adminBanner.style.fontSize = '16px';
    adminBanner.style.userSelect = 'none';
    adminBanner.style.zIndex = '9999';
  }
});