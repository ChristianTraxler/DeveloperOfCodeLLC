// Opens full web addresses in a new tab. Site paths like /intake.html and #work open in place.
export default function ExtLink({ href, children, ...rest }) {
  const external = /^https?:/i.test(href)
  const extra = external ? { target: '_blank', rel: 'noopener' } : {}
  return (
    <a href={href} {...extra} {...rest}>
      {children}
    </a>
  )
}
