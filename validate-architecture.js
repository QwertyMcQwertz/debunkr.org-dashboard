/**
 * Architecture Validation Script
 * Run this in the browser console to validate the modular architecture
 */

(() => {
  console.log('🔍 Validating Architecture...');
  
  const validationResults = {
    success: true,
    errors: [],
    warnings: [],
    components: {},
    events: {}
  };

  // Validate EventBus
  try {
    if (typeof EventBus !== 'function') {
      throw new Error('EventBus class not found');
    }
    if (typeof EventTypes !== 'object') {
      throw new Error('EventTypes constants not found');
    }
    validationResults.components.EventBus = '✅ Available';
    console.log('✅ EventBus: OK');
  } catch (error) {
    validationResults.success = false;
    validationResults.errors.push(`EventBus: ${error.message}`);
    console.error('❌ EventBus:', error.message);
  }

  // Validate Domain Models
  try {
    if (typeof Message !== 'function') {
      throw new Error('Message class not found');
    }
    if (typeof Chat !== 'function') {
      throw new Error('Chat class not found');
    }
    validationResults.components.Models = '✅ Available';
    console.log('✅ Domain Models: OK');
  } catch (error) {
    validationResults.success = false;
    validationResults.errors.push(`Models: ${error.message}`);
    console.error('❌ Domain Models:', error.message);
  }

  // Validate Controllers
  const controllers = [
    'RoutingController',
    'ChatController', 
    'MessageController',
    'SettingsController'
  ];

  controllers.forEach(controllerName => {
    try {
      if (typeof window[controllerName] !== 'function') {
        throw new Error(`${controllerName} class not found`);
      }
      validationResults.components[controllerName] = '✅ Available';
      console.log(`✅ ${controllerName}: OK`);
    } catch (error) {
      validationResults.success = false;
      validationResults.errors.push(`${controllerName}: ${error.message}`);
      console.error(`❌ ${controllerName}:`, error.message);
    }
  });

  // Validate Application Instance
  try {
    if (typeof ChatApplication !== 'function') {
      throw new Error('ChatApplication class not found');
    }
    if (!window.chatApplication) {
      throw new Error('ChatApplication instance not found');
    }
    validationResults.components.ChatApplication = '✅ Available';
    console.log('✅ ChatApplication: OK');
  } catch (error) {
    validationResults.success = false;
    validationResults.errors.push(`ChatApplication: ${error.message}`);
    console.error('❌ ChatApplication:', error.message);
  }

  // Test EventBus functionality
  if (window.chatApplication && window.chatApplication.eventBus) {
    try {
      const testEventFired = new Promise(resolve => {
        const unsubscribe = window.chatApplication.eventBus.on('test:validation', () => {
          unsubscribe();
          resolve(true);
        });
        setTimeout(() => resolve(false), 1000);
      });

      window.chatApplication.eventBus.emit('test:validation', { test: true });
      
      testEventFired.then(success => {
        if (success) {
          validationResults.events.testEvent = '✅ Working';
          console.log('✅ Event System: OK');
        } else {
          validationResults.warnings.push('Event system may not be working correctly');
          console.warn('⚠️ Event System: May have issues');
        }
      });
    } catch (error) {
      validationResults.warnings.push(`Event system test failed: ${error.message}`);
      console.warn('⚠️ Event System Test:', error.message);
    }
  }

  // Test Domain Model Creation
  try {
    const testEventBus = new EventBus();
    const testMessage = new Message({
      content: 'Test message',
      type: 'user'
    });
    const testChat = new Chat({
      id: 999,
      title: 'Test Chat'
    }, testEventBus);
    
    if (testMessage.content === 'Test message' && testChat.title === 'Test Chat') {
      validationResults.components.DomainModelCreation = '✅ Working';
      console.log('✅ Domain Model Creation: OK');
    }
  } catch (error) {
    validationResults.warnings.push(`Domain model creation test failed: ${error.message}`);
    console.warn('⚠️ Domain Model Creation:', error.message);
  }

  // Output summary
  console.log('\n📊 Validation Summary:');
  console.log(`Overall Status: ${validationResults.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Errors: ${validationResults.errors.length}`);
  console.log(`Warnings: ${validationResults.warnings.length}`);
  
  if (validationResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    validationResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (validationResults.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    validationResults.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  console.log('\n🔧 Component Status:');
  Object.entries(validationResults.components).forEach(([name, status]) => {
    console.log(`  ${name}: ${status}`);
  });

  // Advanced diagnostics if application is available
  if (window.chatApplication && window.chatApplication.getDiagnostics) {
    console.log('\n📈 Application Diagnostics:');
    window.chatApplication.getDiagnostics().then(diagnostics => {
      console.log(diagnostics);
    }).catch(error => {
      console.warn('Could not get application diagnostics:', error.message);
    });
  }

  return validationResults;
})();