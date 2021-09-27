---
---
<div> <!-- Only needed with Hugo <= **version TBD** -->
  <test name="should render successful with alert">
  {{% callout type="alert" %}}
  An alert type callout
  {{% /callout %}}
  </test>

  <test name="should render successful with warning">
  {{% callout type="warning" %}}
  An warning type callout
  {{% /callout %}}
  </test>

  <test name="should show error when missing type parameter.">
  {{% callout %}}
  An note type callout
  {{% /callout %}}
  </test>

  <test name="should show error when enter invalid type.">
  {{% callout type="invalid" %}}
  An note type callout
  {{% /callout %}}
  </test>
</div>