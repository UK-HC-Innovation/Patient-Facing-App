targetScope = 'resourceGroup'

@description('Azure region returned by the existing Container Apps environment.')
param location string

@description('Existing Azure Container Apps environment name.')
param environmentName string

@description('Existing Azure Container Registry name.')
param acrName string

@description('Existing user-assigned identity with permission to pull from ACR.')
param pullIdentityName string = 'id-foodlens-acr-pull'

@description('Container App resource name.')
param appName string = 'ca-foodlens'

@description('Friendly workload-profile name returned by the existing environment.')
param workloadProfileName string = 'Consumption'

@description('Immutable ACR image reference in login-server/repository@sha256:digest form.')
@minLength(80)
param imageDigestRef string

@minValue(0)
param minReplicas int = 1

@minValue(1)
param maxReplicas int = 1

@description('Additional non-sensitive resource tags.')
param additionalTags object = {}

var resourceTags = union(resourceGroup().tags, additionalTags, {
  Project: 'foodlens'
  Environment: 'Development'
  DataClassification: 'Synthetic'
})

resource environment 'Microsoft.App/managedEnvironments@2026-01-01' existing = {
  name: environmentName
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: pullIdentityName
}

resource app 'Microsoft.App/containerApps@2026-01-01' = {
  name: appName
  location: location
  tags: resourceTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: workloadProfileName
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: pullIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'foodlens'
          image: imageDigestRef
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'HOSTNAME'
              value: '0.0.0.0'
            }
            {
              name: 'APP_SURFACE'
              value: 'foodlens'
            }
            {
              name: 'HEALTH_AI_PROVIDER'
              value: 'mock'
            }
            {
              name: 'FOOD_PACKAGE_SCAN_ENABLED'
              value: '0'
            }
            {
              name: 'NEXT_PUBLIC_FOOD_PACKAGE_SCAN'
              value: '0'
            }
            {
              name: 'APP_OPERATING_MODE'
              value: 'synthetic'
            }
            {
              name: 'APPROVED_SYNTHETIC_DEMO'
              value: 'true'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 1
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 10
              successThreshold: 1
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 1
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 3
              successThreshold: 1
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 15
              periodSeconds: 15
              timeoutSeconds: 3
              failureThreshold: 3
              successThreshold: 1
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output appName string = app.name
output fqdn string = app.properties.configuration.ingress.fqdn
output image string = imageDigestRef
