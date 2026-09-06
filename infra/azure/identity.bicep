targetScope = 'resourceGroup'

@description('Existing Azure Container Registry name.')
param acrName string

@description('User-assigned identity created for FoodLens image pulls.')
param pullIdentityName string = 'id-foodlens-acr-pull'

@description('Built-in role definition GUID selected from the registry authorization mode.')
param pullRoleDefinitionGuid string

@description('Additional non-sensitive resource tags.')
param additionalTags object = {}

var resourceTags = union(resourceGroup().tags, additionalTags, {
  Project: 'foodlens'
  DataClassification: 'Synthetic'
})

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: pullIdentityName
  location: resourceGroup().location
  tags: resourceTags
}

resource pullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, pullIdentity.id, pullRoleDefinitionGuid)
  scope: acr
  properties: {
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      pullRoleDefinitionGuid
    )
  }
}

output pullIdentityId string = pullIdentity.id
output pullIdentityPrincipalId string = pullIdentity.properties.principalId
