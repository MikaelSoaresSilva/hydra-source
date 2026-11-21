package com.aurea.fit

/** Aplicativo usado nos testes: banco em memória, novo a cada teste (isolamento total). */
class TestAureaApp : AureaApp() {
    override fun createContainer() = AppContainer(this, inMemoryDb = true)
}
